export class Robot {
    x: number;
    y: number;
    angle: number; // in radians

    // Base physical dimensions in CM
    readonly PHYSICAL_WIDTH_CM = 18.5;
    readonly PHYSICAL_HEIGHT_CM = 18.5;

    // Pixel rendered dimensions
    width: number;
    height: number;
    sensorSpacing: number;
    speedScale: number;

    lSpeed: number = 0;
    rSpeed: number = 0;

    // 8 sensors at the front
    sensors: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
    ctx: CanvasRenderingContext2D | null = null;

    _isSimulationRunning: boolean = false;
    _tickResolve: (() => void) | null = null;

    constructor(startX: number, startY: number, startAngle: number, pixelsPerCm: number = 5.33) {
        this.x = startX;
        this.y = startY;
        this.angle = startAngle;

        // Scale the robot to match track physics
        this.width = this.PHYSICAL_WIDTH_CM * pixelsPerCm;
        this.height = this.PHYSICAL_HEIGHT_CM * pixelsPerCm;

        // Sensor spacing roughly covers the front width (18.5cm) across 8 sensors
        // Assuming about 2cm between each sensor
        this.sensorSpacing = 2.0 * pixelsPerCm;

        // Base velocity mapped to physics scaling
        this.speedScale = pixelsPerCm * 0.7; // ~0.7 cm per millisecond per unit of PWM
    }

    setContext(ctx: CanvasRenderingContext2D) {
        this.ctx = ctx;
    }

    update(dt: number) {
        if (!this._isSimulationRunning) return;

        // Kinematics for differential drive
        // lSpeed and rSpeed are mapped from PWM (0-255). 
        // We scale them to match physical robot velocity vs ms delay.
        const vL = this.lSpeed * this.speedScale;
        const vR = this.rSpeed * this.speedScale;

        const wheelDistance = this.width; // distance between wheels

        const v = (vL + vR) / 2;
        // In Canvas (+Y is down), positive angle rotation is Clockwise (Right). 
        // If left wheel is faster than right wheel, robot turns Clockwise.
        const omega = (vL - vR) / wheelDistance; // rotational velocity

        this.x += v * Math.cos(this.angle) * dt;
        this.y += v * Math.sin(this.angle) * dt;
        this.angle += omega * dt;

        if (this._tickResolve) {
            this._tickResolve();
            this._tickResolve = null;
        }
    }

    readSensors() {
        if (!this.ctx) return;

        // Simulate 8 sensors across the front
        const curveAmount = 0.5; // Controls the bow of the curve

        for (let i = 0; i < 8; i++) {
            // Index 0 to 7 -> center is 3.5.
            // The physical array is at the front of the robot. 
            // When angle=0, robot faces right. 
            // Front is at X = +this.height/2.
            // Left-to-right spread is along the Y axis.
            const offsetFromCenter = i - 3.5;

            // X position: Front of the robot, slightly pulled back for the arc curve.
            const localX = this.height / 2 - (Math.abs(offsetFromCenter) * Math.abs(offsetFromCenter) * curveAmount);
            // Y position: Spread from left to right (- to +)
            const localY = offsetFromCenter * this.sensorSpacing;

            // Transform local to global map coordinates
            const globalX = this.x + localX * Math.cos(this.angle) - localY * Math.sin(this.angle);
            const globalY = this.y + localX * Math.sin(this.angle) + localY * Math.cos(this.angle);

            // Read pixel data
            const pixel = this.ctx.getImageData(globalX, globalY, 1, 1).data;
            // Background is white (255,255,255), line is dark grey/black (34,34,34). 
            // Average < 128 -> Sum < 384
            const isDark = (pixel[0] + pixel[1] + pixel[2]) < 384;

            this.sensors[i] = isDark ? 1 : 0;
        }
    }

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        // Add 90 degrees since 0 rad is pointing right, but car drawn pointing up
        ctx.rotate(this.angle + Math.PI / 2);

        // Draw robot body
        ctx.fillStyle = '#3b82f6'; // blue
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // Draw wheels
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-this.width / 2 - 4, -this.height / 4, 4, this.height / 2);
        ctx.fillRect(this.width / 2, -this.height / 4, 4, this.height / 2);

        // Draw 8 sensors with arc curve
        const curveAmount = 0.5;
        // To make the visual debugging dots match the global raycast coordinates exactly,
        // we'll draw them in global space instead of local space.
        for (let i = 0; i < 8; i++) {
            const offsetFromCenter = i - 3.5;
            // The physical array is at the front of the robot. 
            // When angle=0, robot faces right. 
            // Front is at X = +this.height/2.
            // Left-to-right spread is along the Y axis.

            // X position: Front of the robot, slightly pulled back for the arc curve.
            const localX = this.height / 2 - (Math.abs(offsetFromCenter) * Math.abs(offsetFromCenter) * curveAmount);
            // Y position: Spread from left to right (- to +)
            const localY = offsetFromCenter * this.sensorSpacing;

            // Transform local to global map coordinates
            const globalX = this.x + localX * Math.cos(this.angle) - localY * Math.sin(this.angle);
            const globalY = this.y + localX * Math.sin(this.angle) + localY * Math.cos(this.angle);

            let isDark = false;
            // Physical IR spread radius (approx 0.25cm = 1/6 of sensorSpacing 1.5cm)
            const optRadius = Math.max(1, Math.floor(this.sensorSpacing / 6));

            // Read pixel data in a bounding box rather than a single 1x1 pixel
            if (this.ctx) {
                const boxSize = optRadius * 2;
                const imgData = this.ctx.getImageData(globalX - optRadius, globalY - optRadius, boxSize, boxSize).data;

                // If ANY pixel in the optical cone is dark, the sensor triggers
                for (let j = 0; j < imgData.length; j += 4) {
                    if ((imgData[j] + imgData[j + 1] + imgData[j + 2]) < 384) {
                        isDark = true;
                        break;
                    }
                }
            }

            this.sensors[i] = isDark ? 1 : 0;

            // Draw physical sensor optical footprint for debugging
            ctx.restore();
            ctx.save();
            ctx.beginPath();
            ctx.arc(globalX, globalY, Math.max(3, optRadius), 0, Math.PI * 2);
            ctx.fillStyle = isDark ? 'red' : 'white';
            ctx.fill();
            ctx.strokeStyle = '#aaa';
            ctx.stroke();

            // Go back into local rotation for the next loop (if needed, though we restore again at end)
            ctx.restore();
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle + Math.PI / 2);
        }

        ctx.restore();
    }

    // ---- mrbMaze42 API Implementations ----

    sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    waitForTick(): Promise<void> {
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
        await this.sleep(100);
    }

    async waitStart() {
        console.log("Waiting for Start");
        await this.sleep(500); // Simulate start button press
    }

    async motor(lSpeed: number, rSpeed: number, delay: number) {
        await this.checkStop();
        this.lSpeed = lSpeed;
        this.rSpeed = rSpeed;
        if (delay > 0) {
            await this.sleep(delay);
            this.lSpeed = 0;
            this.rSpeed = 0;
        }
    }

    // Simulated turn right exactly like docx module
    async tright(power: number) {
        // 1. Putar kanan, tunggu sampai sensor tengah lepas garis agar tidak double trigger
        while (this._isSimulationRunning) {
            this.readSensors();
            this.lSpeed = power;
            this.rSpeed = -power;
            // Sensor 4 dan 5 adalah index 3 dan 4 (karena array JavaScript mulai dari 0)
            if (this.sensors[3] === 0 && this.sensors[4] === 0) break;
            await this.waitForTick();
        }

        // 2. Putar kanan, sampai sensor tengah terkena garis
        while (this._isSimulationRunning) {
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
        while (this._isSimulationRunning) {
            this.readSensors();
            this.lSpeed = -power;
            this.rSpeed = power;
            // Sensor 4 dan 5 adalah index 3 dan 4
            if (this.sensors[3] === 0 && this.sensors[4] === 0) break;
            await this.waitForTick();
        }

        // 2. Putar kiri, sampai sensor tengah terkena garis
        while (this._isSimulationRunning) {
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
        while (this._isSimulationRunning) {
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
        while (this._isSimulationRunning) {
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
        while (this._isSimulationRunning) {
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

    async lineTraceTick(power: number) {
        this.readSensors();
        let error = 0;
        let sum = 0;
        const weights = [-4, -3, -2, -1, 1, 2, 3, 4];

        for (let i = 0; i < 8; i++) {
            error += this.sensors[i] * weights[i];
            sum += this.sensors[i];
        }

        if (sum > 0) {
            error = error / sum;
        }

        const kp = power * 0.5; // Simple Kp tuned for general tracing
        const turn = error * kp;

        this.lSpeed = power + turn;
        this.rSpeed = power - turn;
        await this.waitForTick();
    }
    // mengedipkan led pada sensor 1x (disimulasikan dengan delay sesaat)
    async blink() { await this.checkStop(); await this.sleep(100); }

    // (line delay) mengikuti garis selama waktu yang ditentukan
    async ld(power: number, delay: number) {
        await this.checkStop();
        const startTime = Date.now();
        while (this._isSimulationRunning && Date.now() - startTime < delay) {
            await this.lineTraceTick(power);
        }
        this.lSpeed = 0;
        this.rSpeed = 0;
    }

    async lineTraceSmooth(power: number) { await this.lineTrace(power); }

    // (past right line) robot mengikuti garis sampai sensor 8 terkena garis, maju selama step
    async prl(power: number, step: number) {
        await this.checkStop();
        while (this._isSimulationRunning) {
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
        while (this._isSimulationRunning) {
            await this.lineTraceTick(power);
            if (this.sensors[0] === 1) {
                break;
            }
        }
        await this.motor(power, power, step);
    }

    // mengikuti garis sampai sensor yang ditentukan terkena garis kemudian robot maju kedepan selama step
    async trigger(power: number, sensor: number, step: number) {
        await this.checkStop();
        const sensorIndex = sensor - 1; // 1 to 8 -> 0 to 7
        if (sensorIndex < 0 || sensorIndex > 7) return;

        while (this._isSimulationRunning) {
            await this.lineTraceTick(power);
            if (this.sensors[sensorIndex] === 1) {
                break;
            }
        }
        await this.motor(power, power, step);
    }

    // (stop at all colour) megikuti garis sampai semua sensor tidak membaca garis (garis putus)
    async sac(power: number) {
        await this.checkStop();
        while (this._isSimulationRunning) {
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
        await this.trigger(power, sensor, step);
        await this.tright(power);
    }

    // (left line sensor) mengikuti garis sampai sensor yang ditentukan terkena garis, maju selama step, berputar ke kiri
    async lls(power: number, sensor: number, step: number) {
        await this.trigger(power, sensor, step);
        await this.tleft(power);
    }

    // (right line delay) mengikuti garis sampai sensor yg ditentukan terkena garis, maju selama step, berputar ke kanan selama delay
    async rld(power: number, sensor: number, step: number, delay: number) {
        await this.trigger(power, sensor, step);
        await this.motor(power, -power, delay);
    }

    // (left line delay) mengikuti garis sampai sensor yg ditentukan terkena garis, maju selama step, berputar ke kiri selama delay
    async lld(power: number, sensor: number, step: number, delay: number) {
        await this.trigger(power, sensor, step);
        await this.motor(-power, power, delay);
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
}
