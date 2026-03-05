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

    sensors: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
    ctx: CanvasRenderingContext2D | null = null;
    lineColor: number = 0; // 0 for dark line (default), 1 for light line
    pixelsPerCm: number = 5.33;

    _isSimulationRunning: boolean = false;
    _tickResolve: (() => void) | null = null;

    constructor(startX: number, startY: number, startAngle: number, pixelsPerCm: number = 5.33) {
        this.x = startX;
        this.y = startY;
        this.angle = startAngle;
        this.pixelsPerCm = pixelsPerCm;

        // Scale the robot to match track physics
        this.width = this.PHYSICAL_WIDTH_CM * pixelsPerCm;
        this.height = this.PHYSICAL_HEIGHT_CM * pixelsPerCm;

        // Sensor spacing roughly covers the front width (18.5cm) across 8 sensors
        // Assuming about 1.5cm between each sensor
        this.sensorSpacing = 1.5 * pixelsPerCm;

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

    getSensorLocalPosition(i: number) {
        // Defines the "M" or "batman" shape of the sensor bar:
        // 2 center sensors are slightly pushed back ("aga mundur tidak moncong")
        // Outer sensors are pushed back to form the curve.
        const pullbacks = [1.5, 0.7, 0.0, 0.4, 0.4, 0.0, 0.7, 1.5]; // unit in cm
        const pullbackPx = pullbacks[i] * this.pixelsPerCm;
        const forwardX = this.height / 2 - pullbackPx;

        const offsetFromCenter = i - 3.5;
        const rightY = offsetFromCenter * this.sensorSpacing;

        return { forwardX, rightY };
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

    draw(ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI / 2);

        const bodyColor = '#0f766e'; // sketch green/blue PCB color
        const wheelColor = '#be123c'; // red wheels from photo
        const battColor = '#dc2626'; // battery red color
        const stemColor = '#e2e8f0'; // white neck
        const headColor = '#1e3a8a'; // dark blue for sensor head

        // The main chassis is around 45% of the full sensor width
        const bodyWidth = this.width * 0.45;
        const bodyHeight = this.height * 0.35;
        // Make wheels scale relative to body width
        const wheelWidth = this.width * 0.12;
        const wheelHeight = bodyHeight * 0.95;

        // Scale gaps relative to overall width
        const wheelGap = this.width * 0.02;

        // Draw wheels (Red like photo)
        ctx.fillStyle = wheelColor;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(-bodyWidth / 2 - wheelWidth - wheelGap, -wheelHeight / 2, wheelWidth, wheelHeight, wheelWidth * 0.2);
            ctx.roundRect(bodyWidth / 2 + wheelGap, -wheelHeight / 2, wheelWidth, wheelHeight, wheelWidth * 0.2);
        } else {
            ctx.fillRect(-bodyWidth / 2 - wheelWidth - wheelGap, -wheelHeight / 2, wheelWidth, wheelHeight);
            ctx.fillRect(bodyWidth / 2 + wheelGap, -wheelHeight / 2, wheelWidth, wheelHeight);
        }
        ctx.fill();

        // Draw main chassis (rear body around battery/wheels)
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight, bodyWidth * 0.1);
        } else {
            ctx.fillRect(-bodyWidth / 2, -bodyHeight / 2, bodyWidth, bodyHeight);
        }
        ctx.fill();

        // Draw battery pack area (reddish) inside main chassis
        ctx.fillStyle = battColor;
        const battWidth = bodyWidth * 0.6;
        const battHeight = bodyHeight * 0.6;
        ctx.fillRect(-battWidth / 2, -battHeight * 0.2, battWidth, battHeight);

        // Draw central stem (leher putih datar) connecting battery to the front sensor bar
        ctx.fillStyle = stemColor;
        const stemWidth = bodyWidth * 0.25;
        // In canvas, UP is -Y. From center of battery, UP to the sensor array.
        const stemStartY = -battHeight * 0.2;
        const stemEndY = -this.height * 0.45;
        ctx.fillRect(-stemWidth / 2, stemEndY, stemWidth, stemStartY - stemEndY);

        // Draw sensor bar (kepala biru tua melengkung)
        ctx.strokeStyle = headColor;
        // Scale stroke thickness based on height
        ctx.lineWidth = this.height * 0.18;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const pos = this.getSensorLocalPosition(i);
            const canvasX = pos.rightY;
            // Shift up slightly relative to thickness so dots stay inside
            const canvasY = -pos.forwardX + (this.height * 0.02);
            if (i === 0) ctx.moveTo(canvasX, canvasY);
            else ctx.lineTo(canvasX, canvasY);
        }
        ctx.stroke();

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
