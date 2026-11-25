import { useStore } from '../store/useStore';
import type { Robot } from '../simulator/Robot';
import { bitmaps } from './bitmaps';
import { OledDisplay } from './OledDisplay';
import { tr } from '../i18n/i18n';

// Emulates the robot's own user interface: the OLED screens and the button
// handling of mrbMaze start() (Go / Speed test / Sensor calibrate / Gripper),
// the welcome screen, and the reset that end() does after a run.
// Button presses come from the Robot panel; tick() runs every animation frame.

export type UiButton = 'up' | 'down' | 'ok' | 'back';
type Screen = 'off' | 'welcome' | 'menu' | 'go' | 'running' | 'ending' | 'speed' | 'calibrate' | 'calibrating' | 'calResult' | 'gripper';

const MENU_MARKER: [number, number][] = [[11, 23], [24, 36], [37, 49], [50, 62]];

class RobotUi {
    readonly oled = new OledDisplay();
    private canvasEl: HTMLCanvasElement | null = null;
    private renderedRev = -1;

    screen: Screen = 'off';
    private menu = 0; // nMode 0..3 in start()
    private side: 1 | -1 = 1; // which value OK selected in speed test / gripper
    private lSpeed = 0;
    private rSpeed = 0;
    private liftPow = 100;
    private gripPow = 0;
    private memSen = [300, 300, 300, 300, 300, 300, 300, 300];
    private calSum = new Array(8).fill(0);
    private calCount = 0;
    private t = 0; // time on the current screen (s)
    private clock = 0;
    private held = new Map<UiButton, number>(); // button -> next auto-repeat time
    private lastPower: boolean | null = null;
    private lastSim = 'idle';
    private manualStopAt = 0;
    private robot: Robot | null = null;

    get canvas(): HTMLCanvasElement {
        if (!this.canvasEl) {
            this.canvasEl = document.createElement('canvas');
            this.canvasEl.width = OledDisplay.W;
            this.canvasEl.height = OledDisplay.H;
        }
        if (this.renderedRev !== this.oled.revision) {
            this.oled.renderTo(this.canvasEl);
            this.renderedRev = this.oled.revision;
        }
        return this.canvasEl;
    }

    private get version() { return useStore.getState().libraryVersion; }

    // Short hint for the panel: what the buttons do on the current screen
    get status(): string {
        const items = [tr('ui.item.go'), tr('ui.item.speed'), tr('ui.item.calibrate'), tr('ui.item.gripper')];
        switch (this.screen) {
            case 'off': return tr('ui.off');
            case 'welcome': return tr('ui.welcome');
            case 'menu': return tr('ui.menu', { item: items[this.menu] });
            case 'go': return tr('ui.go');
            case 'running': return tr('ui.running');
            case 'ending': return tr('ui.ending');
            case 'speed': return tr('ui.speed', { side: tr(this.side === 1 ? 'ui.left' : 'ui.right') });
            case 'calibrate': return tr('ui.calibrate');
            case 'calibrating': return tr('ui.calibrating');
            case 'calResult': return tr('ui.calResult');
            case 'gripper': return tr('ui.gripper', { side: this.side === 1 ? 'LIFT' : 'GRIP' });
        }
    }

    private go(screen: Screen) {
        this.screen = screen;
        this.t = 0;
    }

    private boot() {
        this.menu = 0;
        // mrbMaze42 example calls welcomeScreen(); the 4.4 example comments it out
        this.go(this.version === '42' ? 'welcome' : 'menu');
    }

    private setLed(on: boolean) {
        const st = useStore.getState();
        if (this.robot && st.simulationState !== 'running') this.robot.ledOn = on;
    }

    // ---- Buttons
    press(b: UiButton) {
        if (!useStore.getState().robotPower) return;
        this.held.set(b, this.clock + this.repeatDelay(b));
        this.act(b);
    }

    release(b: UiButton) { this.held.delete(b); }

    // Delays copied from the delay() after each button check in start()
    private repeatDelay(b: UiButton): number {
        if (b === 'ok' || b === 'back') return Infinity; // one action per press
        if (this.screen === 'speed') return 0.07;
        if (this.screen === 'gripper') return this.version === '44' ? 0.02 : 0.1;
        return 0.2;
    }

    private act(b: UiButton) {
        const step = this.version === '44' ? 1 : 5;
        switch (this.screen) {
            case 'menu':
                if (b === 'up') this.menu = (this.menu + 3) % 4;
                else if (b === 'down') this.menu = (this.menu + 1) % 4;
                else if (b === 'ok') {
                    if (this.menu === 0) { this.go('go'); this.setLed(true); }
                    else if (this.menu === 1) { this.lSpeed = this.rSpeed = 0; this.side = 1; this.go('speed'); }
                    else if (this.menu === 2) { this.go('calibrate'); }
                    else { this.liftPow = 100; this.gripPow = 0; this.side = 1; this.go('gripper'); }
                }
                break;
            case 'speed': {
                const clamp = (v: number) => Math.max(-250, Math.min(250, v));
                if (b === 'ok') this.side = this.side === 1 ? -1 : 1;
                else if (b === 'back') { this.lSpeed = this.rSpeed = 0; this.manualStopAt = this.clock + 0.4; this.menu = 1; this.go('menu'); }
                else {
                    const d = b === 'up' ? 5 : -5;
                    if (this.side === 1) this.lSpeed = clamp(this.lSpeed + d);
                    else this.rSpeed = clamp(this.rSpeed + d);
                }
                break;
            }
            case 'calibrate':
                if (b === 'ok') { this.calSum.fill(0); this.calCount = 0; this.go('calibrating'); }
                else if (b === 'back') { this.menu = 2; this.go('menu'); }
                break;
            case 'calResult':
                if (b === 'ok' || b === 'back') this.go('calibrate');
                break;
            case 'gripper': {
                const clamp = (v: number) => Math.max(0, Math.min(100, v));
                if (b === 'ok') this.side = this.side === 1 ? -1 : 1;
                else if (b === 'back') { this.menu = 3; this.go('menu'); }
                else {
                    const d = b === 'up' ? step : -step;
                    if (this.side === 1) this.liftPow = clamp(this.liftPow + d);
                    else this.gripPow = clamp(this.gripPow + d);
                }
                break;
            }
            default:
                break; // welcome, go, running, ending: buttons are not read
        }
    }

    // ---- Per-frame update
    tick(dt: number, robot: Robot | null) {
        this.robot = robot;
        this.clock += dt;
        this.t += dt;
        const st = useStore.getState();

        if (robot) robot.motorPower = st.robotPower && st.motorPower;

        // POWER switch
        if (st.robotPower !== this.lastPower) {
            this.lastPower = st.robotPower;
            if (st.robotPower) this.boot();
            else {
                this.go('off');
                if (st.simulationState === 'running') st.setSimulationState('idle');
                if (robot) { robot.manualDrive = false; robot.stopWheels(); robot.ledOn = false; }
            }
        }

        // Program runs started from the Simulate button or from Go
        if (st.simulationState === 'running' && this.screen !== 'running' && this.screen !== 'off') this.go('running');
        if (this.lastSim === 'running' && st.simulationState !== 'running' && this.screen === 'running') {
            this.go('ending'); // my.end(): blink the LED, then reset the board
        }
        this.lastSim = st.simulationState;

        // Auto-repeat for held buttons
        for (const [b, next] of this.held) {
            if (this.clock >= next) {
                this.act(b);
                this.held.set(b, this.clock + this.repeatDelay(b));
            }
        }

        // Speed test drives the motors directly
        if (robot && st.simulationState !== 'running') {
            if (this.screen === 'speed') {
                robot.manualDrive = true;
                robot.lSpeed = this.lSpeed;
                robot.rSpeed = this.rSpeed;
            } else if (robot.manualDrive) {
                robot.lSpeed = robot.rSpeed = 0;
                if (this.clock >= this.manualStopAt) robot.manualDrive = false;
            }
        }

        this.step(robot);
        this.draw(robot);
    }

    // Timed transitions
    private step(robot: Robot | null) {
        const st = useStore.getState();
        switch (this.screen) {
            case 'welcome':
                this.setLed(true);
                if (this.t > 0.75) { this.setLed(false); this.go('menu'); }
                break;
            case 'go':
                // led on, delay(500), clear; then ledSen on, delay(200) and loop() starts
                if (this.t > 0.7) { this.setLed(false); st.setSimulationState('running'); }
                break;
            case 'ending':
                this.setLed(this.t < 0.5);
                if (this.t > 0.6) this.boot();
                break;
            case 'calibrating': {
                // 40 samples, 100 ms apart, LED blinking
                this.setLed(this.t % 0.1 < 0.05);
                const due = Math.min(40, Math.floor(this.t / 0.1));
                while (this.calCount < due && robot) {
                    const raw = robot.readAnalog();
                    raw.forEach((v, i) => { this.calSum[i] += v; });
                    this.calCount++;
                }
                if (this.calCount >= 40) {
                    this.memSen = this.calSum.map(s => Math.floor(s / 40) + 100);
                    this.setLed(false);
                    this.go('calResult');
                }
                break;
            }
        }
    }

    private header() {
        const d = this.oled;
        if (this.version === '44') {
            d.setTextSize(1);
            d.setCursor(0, 0);
            d.print('V4.4');
            return;
        }
        // battTest(): battery icon + percentage (the simulated pack is full)
        const pct = 100;
        d.bitmap(0, 0, bitmaps('42').batt);
        const bar = Math.min(11, Math.round(1 + (pct / 100) * 10));
        for (let y = 2; y <= 5; y++) d.hline(2, bar, y);
        d.setTextSize(1);
        d.setCursor(18, 0);
        d.print(`${pct}%`);
    }

    private draw(robot: Robot | null) {
        const d = this.oled;
        const bm = bitmaps(this.version);
        d.clear();
        switch (this.screen) {
            case 'welcome': {
                d.bitmap(0, 10, bm.myrobo);
                if (this.version === '44') { d.setTextSize(1); d.setCursor(102, 52); d.print('4.4'); }
                d.pixel(127, 63);
                const n = Math.min(127, 102 + Math.floor(this.t / 0.025));
                d.hline(102, n, 63);
                break;
            }
            case 'menu':
            case 'go': {
                if (this.screen === 'go' && this.t > 0.5) break; // display cleared
                const m = this.menu;
                if (m === 0) d.bitmap(25, 3, bm.startMode);
                else if (m === 1) d.bitmap(40, 8, bm.speedTest);
                else if (m === 2) d.bitmap(21, 15, bm.sensorCalibrate);
                else d.bitmap(40, 12, bm.gripper);
                d.vline(1, 10, 63);
                const [y0, y1] = MENU_MARKER[m];
                d.vline(0, y0, y1);
                d.vline(2, y0, y1);
                this.header();
                break;
            }
            case 'speed': {
                d.bitmap(32, 19, bm.motorTest);
                d.setTextSize(1);
                d.setCursor(2, 28);
                d.print(this.lSpeed);
                d.setCursor(103, 28);
                d.print(this.rSpeed);
                if (this.side === 1) d.hline(2, 20, 38); else d.hline(103, 121, 38);
                if (this.lSpeed > 0) d.bitmap(33, 45, bm.forward); else if (this.lSpeed < 0) d.bitmap(33, 2, bm.backward);
                if (this.rSpeed > 0) d.bitmap(85, 45, bm.forward); else if (this.rSpeed < 0) d.bitmap(85, 2, bm.backward);
                break;
            }
            case 'calibrate': {
                d.setTextSize(1);
                d.setCursor(22, 4);
                d.print('DIGITAL SENSOR');
                d.setCursor(4, 55);
                d.print('Push OK to Calibrate');
                d.hline(13, 115, 41);
                const raw = robot ? robot.readAnalog() : new Array(8).fill(0);
                raw.forEach((v, i) => {
                    const x = i * 12 + 18;
                    // senTest(): reading above the threshold -> 0 (dark), else 1
                    if (v > this.memSen[i]) d.hline(x, x + 7, 40);
                    else for (let y = 26; y <= 40; y++) d.hline(x, x + 7, y);
                });
                break;
            }
            case 'calResult': {
                d.setTextSize(1);
                d.setCursor(0, 2);
                d.print('SENSOR SET OUTPUT');
                this.memSen.forEach((v, i) => {
                    d.setCursor(i < 4 ? 0 : 51, 16 + (i % 4) * 12);
                    d.print(`${i + 1}. ${v}`);
                });
                break;
            }
            case 'gripper': {
                d.setTextSize(1);
                d.setCursor(14, 17);
                d.print('LIFT :');
                d.setCursor(14, 47);
                d.print('GRIP :');
                d.setTextSize(2);
                d.setCursor(58, 13);
                d.print(this.liftPow);
                d.setCursor(58, 43);
                d.print(this.gripPow);
                const [y0, y1] = this.side === 1 ? [15, 27] : [45, 57];
                d.vline(6, y0, y1);
                d.vline(7, y0, y1);
                break;
            }
            default:
                break; // off, running, ending, calibrating: blank screen
        }
        d.commit();
    }
}

export const robotUi = new RobotUi();
