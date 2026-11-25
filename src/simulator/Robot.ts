import { drawRobotBody, type Draw2DOptions } from './robotDraw2D';
import type { PartId } from './robotLayout';

export class Robot {
    // Robot speed in cm/s for each unit of motor power (PWM 0-255)
    static readonly CM_PER_SEC_PER_PWM = 0.9;
    // Motors don't change speed instantly: each wheel approaches the commanded
    // speed with this time constant (and keeps rolling briefly after a stop)
    static readonly MOTOR_TAU = 0.035; // seconds
    // Control loops (line trace, turns, junctions) step the physics in small
    // increments, like the firmware's ~2 ms loop, so a fast spin can't jump
    // over the line between two sensor reads.
    static readonly CONTROL_DT = 0.005; // seconds
    static readonly TICK_UNIT = 0.016; // actionTicks are counted in 16 ms units
    x: number;
    y: number;
    angle: number; // in radians

    // Real robot: 18.5 x 18.5 cm overall. The wheel axle is at the rear, so the
    // robot pivots there and the sensors sit far ahead of it.
    readonly PHYSICAL_WIDTH_CM = 18.5;
    readonly PHYSICAL_HEIGHT_CM = 18.5;
    readonly SENSOR_FORWARD_CM = 14.5; // axle -> foremost sensors
    readonly WHEEL_TRACK_CM = 16.5; // distance between the two tyre centres

    // Pixel dimensions
    width: number;
    height: number;
    sensorForward: number;
    wheelTrack: number;
    sensorSpacing: number;
    speedScale: number;

    // Commanded motor power (what the program asks for)
    lSpeed: number = 0;
    rSpeed: number = 0;
    // Actual wheel speed in the same units, lagging behind the command
    wheelL: number = 0;
    wheelR: number = 0;
    motorPower: boolean = true; // MOTOR switch: off = the wheels get no power
    manualDrive: boolean = false; // speed-test menu drives the robot outside a program run

    // Visual only: distance rolled by each wheel (cm) and the Nano's pin-13 LED
    wheelPhaseL: number = 0;
    wheelPhaseR: number = 0;
    ledOn: boolean = false;

    sensors: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
    ctx: CanvasRenderingContext2D | null = null;
    lineColor: number = 0; // 0 for dark line (default), 1 for light line
    pixelsPerCm: number = 5.33;

    _isSimulationRunning: boolean = false;
    _tickResolve: (() => void) | null = null;
    tickBudget: number = 0; // real time (s) the control loop may still simulate before the next frame
    fastMode: boolean = false;
    simTime: number = 0;
    actionTicks: number = 0;
    actionTimedOut: boolean = false;
    isTrainingMode: boolean = false;
    runId: number = 0;

    getNow(): number {
        return this.fastMode ? this.simTime : Date.now();
    }

    constructor(startX: number, startY: number, startAngle: number, pixelsPerCm: number = 5.33) {
        this.x = startX;
        this.y = startY;
        this.angle = startAngle;
        this.pixelsPerCm = pixelsPerCm;

        // Scale the robot to match track physics
        this.width = this.PHYSICAL_WIDTH_CM * pixelsPerCm;
        this.height = this.PHYSICAL_HEIGHT_CM * pixelsPerCm;
        this.sensorForward = this.SENSOR_FORWARD_CM * pixelsPerCm;
        this.wheelTrack = this.WHEEL_TRACK_CM * pixelsPerCm;

        // About 1.5 cm between neighbouring sensors
        this.sensorSpacing = 1.5 * pixelsPerCm;

        // Speed per PWM unit, calibrated on the real robot: at power 100 a
        // junction step of 120 ms puts the wheel axle on the crossing
        // (~14 cm past the point where the sensors see it).
        this.speedScale = pixelsPerCm * Robot.CM_PER_SEC_PER_PWM;
    }

    setContext(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
    }

    // Reset episode-level state so each Simulate run starts clean.
    // Without this, actionTicks/actionTimedOut accumulate across runs and
    // every line-trace/turn action no-ops after ~1500 cumulative ticks.
    resetRunState() {
        this.actionTicks = 0;
        this.actionTimedOut = false;
        this.simTime = 0;
        this.lSpeed = 0;
        this.rSpeed = 0;
        this.lineError = 0;
        this.lineErrorLast = 0;
        this.wheelL = 0;
        this.wheelR = 0;
        this.manualDrive = false;
        this._tickResolve = null; // abandon pending tick from a stopped run
        this.tickBudget = 0;
        this.runId++; // invalidate any stale runner suspended in sleep()
    }

    // Stop dead (used when the robot is picked up and placed)
    stopWheels() {
        this.lSpeed = this.rSpeed = 0;
        this.wheelL = this.wheelR = 0;
    }

    update(dt: number) {
        if (!this._isSimulationRunning && !this.manualDrive) return;

        // Motor inertia: first-order lag toward the commanded power
        const k = 1 - Math.exp(-dt / Robot.MOTOR_TAU);
        this.wheelL += ((this.motorPower ? this.lSpeed : 0) - this.wheelL) * k;
        this.wheelR += ((this.motorPower ? this.rSpeed : 0) - this.wheelR) * k;

        // Kinematics for differential drive
        // lSpeed and rSpeed are mapped from PWM (0-255). 
        // We scale them to match physical robot velocity vs ms delay.
        const vL = this.wheelL * this.speedScale;
        const vR = this.wheelR * this.speedScale;

        const wheelDistance = this.wheelTrack;

        const v = (vL + vR) / 2;
        // In Canvas (+Y is down), positive angle rotation is Clockwise (Right). 
        // If left wheel is faster than right wheel, robot turns Clockwise.
        const omega = (vL - vR) / wheelDistance; // rotational velocity

        this.x += v * Math.cos(this.angle) * dt;
        this.y += v * Math.sin(this.angle) * dt;
        this.angle += omega * dt;
        this.wheelPhaseL += (vL * dt) / this.pixelsPerCm;
        this.wheelPhaseR += (vR * dt) / this.pixelsPerCm;

        if (this.fastMode) {
            this.simTime += dt * 1000;
        }
    }

    // Called once per animation frame. While a control loop is running it moves
    // the robot itself (see waitForTick), so the frame only hands it the
    // elapsed time; otherwise (motor() + delay) the frame moves the robot.
    frame(dt: number) {
        if (!this._isSimulationRunning) {
            if (this.manualDrive) this.update(dt);
            return;
        }
        if (this._tickResolve) {
            this.tickBudget = Math.min(this.tickBudget + dt, 0.1);
            const resolve = this._tickResolve;
            this._tickResolve = null;
            resolve();
        } else {
            this.tickBudget = 0;
            this.update(dt);
        }
    }

    getSensorLocalPosition(i: number) {
        // Defines the "M" or "batman" shape of the sensor bar:
        // 2 center sensors are slightly pushed back ("aga mundur tidak moncong")
        // Outer sensors are pushed back to form the curve.
        const pullbacks = [1.5, 0.7, 0.0, 0.4, 0.4, 0.0, 0.7, 1.5]; // unit in cm
        const pullbackPx = pullbacks[i] * this.pixelsPerCm;
        const forwardX = this.sensorForward - pullbackPx;

        const offsetFromCenter = i - 3.5;
        const rightY = offsetFromCenter * this.sensorSpacing;

        return { forwardX, rightY };
    }

    // Emulated analogRead() of each sensor (0-999, like mrbMaze44's clamp):
    // a dark floor reflects little light, so the reading is high.
    readAnalog(): number[] {
        const out: number[] = [];
        for (let i = 0; i < 8; i++) {
            const pos = this.getSensorLocalPosition(i);
            const gx = this.x + pos.forwardX * Math.cos(this.angle) - pos.rightY * Math.sin(this.angle);
            const gy = this.y + pos.forwardX * Math.sin(this.angle) + pos.rightY * Math.cos(this.angle);
            let sum = 765;
            if (this.ctx) {
                const px = this.ctx.getImageData(gx, gy, 1, 1).data;
                sum = px[0] + px[1] + px[2];
            }
            const noise = Math.round((Math.random() - 0.5) * 12);
            out.push(Math.max(0, Math.min(999, Math.round(90 + ((765 - sum) / 765) * 760) + noise)));
        }
        return out;
    }

    readSensors() {
        if (!this.ctx) return;

        for (let i = 0; i < 8; i++) {
            const pos = this.getSensorLocalPosition(i);
            const localX = pos.forwardX;
            const localY = pos.rightY;

            // Transform local to global map coordinates
            const globalX = this.x + localX * Math.cos(this.angle) - localY * Math.sin(this.angle);
            const globalY = this.y + localX * Math.sin(this.angle) + localY * Math.cos(this.angle);

            // Read pixel data
            const pixel = this.ctx.getImageData(globalX, globalY, 1, 1).data;
            const pixelSum = pixel[0] + pixel[1] + pixel[2];

            let isLine = false;
            // Background is white (255,255,255), line is dark grey/black (34,34,34).
            // Average < 128 -> Sum < 384
            if (this.lineColor === 0) {
                isLine = pixelSum < 384; // Dark line
            } else {
                isLine = pixelSum > 384; // Light line
            }

            this.sensors[i] = isLine ? 1 : 0;
        }
    }

    draw(ctx: CanvasRenderingContext2D, highlight: PartId | null = null, extras: Pick<Draw2DOptions, 'oled' | 'powerOn' | 'motorOn'> = {}) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        drawRobotBody(ctx, {
            ppc: this.pixelsPerCm,
            sensors: Array.from({ length: 8 }, (_, i) => {
                const p = this.getSensorLocalPosition(i);
                return { f: p.forwardX / this.pixelsPerCm, s: p.rightY / this.pixelsPerCm };
            }),
            wheelPhaseL: this.wheelPhaseL,
            wheelPhaseR: this.wheelPhaseR,
            highlight,
            ledOn: this.ledOn,
            ...extras,
        });
        ctx.restore(); // Exit local rotation space

        // To make the visual debugging dots match the global raycast coordinates exactly,
        // we draw them in global space.
        for (let i = 0; i < 8; i++) {
            const pos = this.getSensorLocalPosition(i);

            const globalX = this.x + pos.forwardX * Math.cos(this.angle) - pos.rightY * Math.sin(this.angle);
            const globalY = this.y + pos.forwardX * Math.sin(this.angle) + pos.rightY * Math.cos(this.angle);

            let isLine = false;
            // Physical IR spread radius
            const optRadius = Math.max(1, Math.floor(this.sensorSpacing / 6));

            if (this.ctx) {
                const boxSize = optRadius * 2;
                // Add boundary check to ensure we don't request negative or out-of-bounds size
                if (boxSize > 0) {
                    const imgData = this.ctx.getImageData(globalX - optRadius, globalY - optRadius, boxSize, boxSize).data;

                    for (let j = 0; j < imgData.length; j += 4) {
                        const pixelSum = imgData[j] + imgData[j + 1] + imgData[j + 2];
                        if (this.lineColor === 0) {
                            if (pixelSum < 384) {
                                isLine = true;
                                break;
                            }
                        } else {
                            if (pixelSum > 384) {
                                isLine = true;
                                break;
                            }
                        }
                    }
                }
            }

            this.sensors[i] = isLine ? 1 : 0;

            // Draw sensor diode dot (Red like user sketch)
            ctx.beginPath();
            ctx.arc(globalX, globalY, Math.max(2, optRadius), 0, Math.PI * 2);
            ctx.fillStyle = isLine ? '#ef4444' : '#ffffff'; // red if triggered, white if not
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = isLine ? '#b91c1c' : '#999';
            ctx.stroke();
        }
    }

    // ---- mrbMaze42 API Implementations ----

    // (line color) mengatur membaca garis gelap/hitam (0) atau garis terang/putih (1)
    async lc(color: number) {
        await this.checkStop();
        this.lineColor = color;
    }

    sleep(ms: number): Promise<void> {
        if (this.fastMode) {
            const step = 16;
            let remaining = ms;
            while (remaining > 0 && this._isSimulationRunning) {
                const dt = Math.min(remaining, step);
                this.update(dt / 1000);
                remaining -= step;
            }
            return Promise.resolve();
        }
        const run = this.runId;
        return new Promise<void>((resolve, reject) => setTimeout(() => {
            if (this.runId !== run) reject(new Error("Simulation Stopped"));
            else resolve();
        }, ms));
    }

    waitForTick(): Promise<void> {
        this.actionTicks += Robot.CONTROL_DT / Robot.TICK_UNIT;
        if (this.isTrainingMode && this.actionTicks > 1500) {
            // ponytail: graceful timeout (flag, bukan throw) supaya episode tetap dapat Q-update
            this.actionTimedOut = true;
            return Promise.resolve();
        }
        this.update(Robot.CONTROL_DT);
        if (this.fastMode) return Promise.resolve();
        // Keep pace with the wall clock: run steps until this frame's time is used up
        this.tickBudget -= Robot.CONTROL_DT;
        if (this.tickBudget > 0) return Promise.resolve();
        return new Promise(resolve => {
            this._tickResolve = resolve;
        });
    }

    async checkStop() {
        if (!this._isSimulationRunning) {
            throw new Error("Simulation Stopped");
        }
    }

    async mazeSetup() {
        console.log("Maze Setup");
        this.lineColor = 0; // Reset to default dark line
        await this.sleep(100);
    }

    async waitStart() {
        console.log("Waiting for Start");
        this.lineColor = 0; // Reset to default dark line just in case
        await this.sleep(500); // Simulate start button press
    }

    async motor(lSpeed: number, rSpeed: number, delay: number) {
        await this.checkStop();
        this.lSpeed = lSpeed;
        this.rSpeed = rSpeed;
        if (delay > 0) {
            this.ledOn = true; // firmware lights pin 13 while motor() runs
            try {
                await this.sleep(delay);
            } finally {
                this.ledOn = false;
            }
            this.lSpeed = 0;
            this.rSpeed = 0;
        }
    }

    // Simulated turn right exactly like docx module
    async tright(power: number) {
        // 1. Putar kanan, tunggu sampai sensor tengah lepas garis agar tidak double trigger
        while (this._isSimulationRunning && !this.actionTimedOut) {
            this.readSensors();
            this.lSpeed = power;
            this.rSpeed = -power;
            // Sensor 4 dan 5 adalah index 3 dan 4 (karena array JavaScript mulai dari 0)
            if (this.sensors[3] === 0 && this.sensors[4] === 0) break;
            await this.waitForTick();
        }

        // 2. Putar kanan, sampai sensor tengah terkena garis
        while (this._isSimulationRunning && !this.actionTimedOut) {
            this.readSensors();
            this.lSpeed = power;
            this.rSpeed = -power;
            // Saat putar KANAN, garis datang dari KANAN (index 7->6->5->4->3). 
            // Kita tunggu sampai menyentuh index 3 agar robot berhenti tepat di TENGAH garis.
            if (this.sensors[3] === 1) break;
            await this.waitForTick();
        }
        this.lSpeed = 0;
        this.rSpeed = 0;
    }

    // Simulated turn left exactly like docx module
    async tleft(power: number) {
        // 1. Putar kiri, tunggu sampai sensor tengah lepas garis
        while (this._isSimulationRunning && !this.actionTimedOut) {
            this.readSensors();
            this.lSpeed = -power;
            this.rSpeed = power;
            // Sensor 4 dan 5 adalah index 3 dan 4
            if (this.sensors[3] === 0 && this.sensors[4] === 0) break;
            await this.waitForTick();
        }

        // 2. Putar kiri, sampai sensor tengah terkena garis
        while (this._isSimulationRunning && !this.actionTimedOut) {
            this.readSensors();
            this.lSpeed = -power;
            this.rSpeed = power;
            // Saat putar KIRI, garis datang dari KIRI (index 0->1->2->3->4).
            // Kita tunggu sampai menyentuh index 4 agar robot berhenti tepat di TENGAH garis.
            if (this.sensors[4] === 1) break;
            await this.waitForTick();
        }
        this.lSpeed = 0;
        this.rSpeed = 0;
    }

    // (right line) robot mengikuti garis sampai sensor 8 terkena garis, kemudian robot maju kedepan selama step, dan berputar ke kanan
    async rl(power: number, step: number) {
        await this.checkStop();
        while (this._isSimulationRunning && !this.actionTimedOut) {
            await this.lineTraceTick(power);
            // Sensor 8 = index 7
            if (this.sensors[7] === 1) {
                break;
            }
        }
        await this.motor(power, power, step);
        await this.tright(power);
    }

    // (left line) robot mengikuti garis sampai sensor 1 terkena garis, kemudian robot maju kedepan selama step, dan berputar ke kiri
    async ll(power: number, step: number) {
        await this.checkStop();
        while (this._isSimulationRunning && !this.actionTimedOut) {
            await this.lineTraceTick(power);
            // Sensor 1 = index 0
            if (this.sensors[0] === 1) {
                break;
            }
        }
        await this.motor(power, power, step);
        await this.tleft(power);
    }

    async lineTrace(power: number) {
        while (this._isSimulationRunning && !this.actionTimedOut) {
            await this.lineTraceTick(power);
            // Check for intersection: if all sensors are black (or something similar depending on need)
            const activeSensors = this.sensors.reduce((a, b) => a + b, 0);
            if (activeSensors >= 6) {
                this.lSpeed = 0;
                this.rSpeed = 0;
                break;
            }
        }
    }

    // Port of mrbMaze42::lineTrace (firmware). Error comes from a fixed table of
    // narrow sensor patterns (1-2 adjacent sensors). Any other pattern, such as
    // 3+ sensors at an intersection/branch or no line at all, KEEPS the previous
    // error, so the robot passes junctions straight instead of being pulled
    // toward the side branch (which a weighted average over all active
    // sensors would do).
    static readonly ERROR_TABLE: Record<string, number> = {
        '00011000': 0,
        '00010000': 1, '00001000': -1,
        '00110000': 2, '00001100': -2,
        '00100000': 3, '00000100': -3,
        '01100000': 4, '00000110': -4,
        '01000000': 5, '00000010': -5,
        '11000000': 6, '00000011': -6,
        '10000000': 7, '00000001': -7,
    };
    // Same gains as the generated Arduino code: my.pidSet(28, 8, 8)
    static readonly KP = 28;
    static readonly KI = 8;
    static readonly KD = 8;
    lineError: number = 0;
    lineErrorLast: number = 0;

    async lineTraceTick(power: number) {
        this.readSensors();

        const mapped = Robot.ERROR_TABLE[this.sensors.join('')];
        if (mapped !== undefined) this.lineError = mapped;
        const error = this.lineError;
        const last = this.lineErrorLast;

        const scale = power / 250;
        const pid = Robot.KP * scale * error
            + Robot.KI * scale * (error + last)
            + Robot.KD * scale * (error - last);

        // Positive error = line on the LEFT -> slow down the left wheel.
        // Like the firmware, wheel speed is capped at `power` (never boosted).
        this.lSpeed = Math.min(power - pid, power);
        this.rSpeed = Math.min(power + pid, power);
        this.lineErrorLast = error;
        await this.waitForTick();
    }
    // mengedipkan led pada sensor 1x (disimulasikan dengan delay sesaat)
    async blink() {
        await this.checkStop();
        this.ledOn = true;
        try { await this.sleep(100); } finally { this.ledOn = false; }
    }

    // (line delay) mengikuti garis selama waktu yang ditentukan
    async ld(power: number, delay: number) {
        await this.checkStop();
        const startTime = this.getNow();
        while (this._isSimulationRunning && !this.actionTimedOut && this.getNow() - startTime < delay) {
            await this.lineTraceTick(power);
        }
        this.lSpeed = 0;
        this.rSpeed = 0;
    }

    async lineTraceSmooth(power: number) { await this.lineTrace(power); }

    // (past right line) robot mengikuti garis sampai sensor 8 terkena garis, maju selama step
    async prl(power: number, step: number) {
        await this.checkStop();
        while (this._isSimulationRunning && !this.actionTimedOut) {
            await this.lineTraceTick(power);
            if (this.sensors[7] === 1) {
                break;
            }
        }
        await this.motor(power, power, step);
    }

    // (past left line) robot mengikuti garis sampai sensor 1 terkena garis, maju selama step
    async pll(power: number, step: number) {
        await this.checkStop();
        while (this._isSimulationRunning && !this.actionTimedOut) {
            await this.lineTraceTick(power);
            if (this.sensors[0] === 1) {
                break;
            }
        }
        await this.motor(power, power, step);
    }

    // mengikuti garis sampai sensor yang ditentukan terkena garis kemudian robot maju kedepan selama step
    // sensor bisa berupa 1 digit (misal 7) atau 2 digit (misal 18 = sensor 1 atau 8)
    async trigger(power: number, sensor: number, step: number): Promise<boolean> {
        await this.checkStop();

        // Parse sensor value: single digit (1-8) or two-digit combo (12 = sensor 1 & 2)
        const sensorIndices: number[] = [];
        if (sensor >= 1 && sensor <= 8) {
            sensorIndices.push(sensor - 1);
        } else if (sensor >= 10 && sensor <= 88) {
            const s1 = Math.floor(sensor / 10);
            const s2 = sensor % 10;
            if (s1 >= 1 && s1 <= 8) sensorIndices.push(s1 - 1);
            if (s2 >= 1 && s2 <= 8) sensorIndices.push(s2 - 1);
        }
        if (sensorIndices.length === 0) return false;

        let detected = false;
        while (this._isSimulationRunning && !this.actionTimedOut) {
            await this.lineTraceTick(power);
            // Cek apakah SALAH SATU sensor terkena garis
            if (sensorIndices.some(idx => this.sensors[idx] === 1)) {
                detected = true;
                break;
            }
        }
        if (detected) {
            await this.motor(power, power, step);
        }
        return detected;
    }

    // (stop at all colour) megikuti garis sampai semua sensor tidak membaca garis (garis putus)
    async sac(power: number) {
        await this.checkStop();
        while (this._isSimulationRunning && !this.actionTimedOut) {
            await this.lineTraceTick(power);
            const activeSensors = this.sensors.reduce((a, b) => a + b, 0);
            if (activeSensors === 0) {
                break;
            }
        }
        this.lSpeed = 0;
        this.rSpeed = 0;
    }

    // (right line sensor) mengikuti garis sampai sensor yang ditentukan terkena garis, maju selama step, berputar ke kanan
    async rls(power: number, sensor: number, step: number) {
        const detected = await this.trigger(power, sensor, step);
        if (detected) await this.tright(power);
    }

    // (left line sensor) mengikuti garis sampai sensor yang ditentukan terkena garis, maju selama step, berputar ke kiri
    async lls(power: number, sensor: number, step: number) {
        const detected = await this.trigger(power, sensor, step);
        if (detected) await this.tleft(power);
    }

    // (right line delay) mengikuti garis sampai sensor yg ditentukan terkena garis, maju selama step, berputar ke kanan selama delay
    async rld(power: number, sensor: number, step: number, delay: number) {
        const detected = await this.trigger(power, sensor, step);
        if (detected) await this.motor(power, -power, delay);
    }

    // (left line delay) mengikuti garis sampai sensor yg ditentukan terkena garis, maju selama step, berputar ke kiri selama delay
    async lld(power: number, sensor: number, step: number, delay: number) {
        const detected = await this.trigger(power, sensor, step);
        if (detected) await this.motor(-power, power, delay);
    }

    // Servo manipulations (simply delay in simulation)
    async pickup(_grip: number, _lift: number, _speed: number, delay: number) {
        await this.checkStop();
        await this.sleep(delay > 0 ? delay : 200);
    }
    async putdown(_speed: number, delay: number) {
        await this.checkStop();
        await this.sleep(delay > 0 ? delay : 200);
    }

    // delay sederhana, menunggu selama ms yang ditentukan
    async delay(ms: number) {
        await this.checkStop();
        await this.sleep(ms);
    }
}
