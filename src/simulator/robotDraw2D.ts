import { BAR_WIDTH, LAYOUT, LAYOUT_BOUNDS, PART_COLORS as C, sensorBoardShape, type PartId, type Pt, type Rect } from './robotLayout';

// Top-view drawing of the robot body. The context must already be translated
// to the robot centre (wheel axle) and rotated by the robot heading, so
// +x = forward and +y = right (matching Robot.getSensorLocalPosition).
// All sizes are in cm and scaled by `ppc` (pixels per cm).

export interface Draw2DOptions {
    ppc: number;
    sensors: { f: number; s: number }[];
    wheelPhaseL: number; // distance rolled by each wheel, in cm
    wheelPhaseR: number;
    highlight: PartId | null;
    ledOn: boolean; // Nano onboard LED (pin 13)
    oled?: HTMLCanvasElement | null; // 128x64 picture shown on the OLED
    powerOn?: boolean; // POWER push switch latched
    motorOn?: boolean; // MOTOR push switch latched
}

type Ctx = CanvasRenderingContext2D;
type Sensors = { f: number; s: number }[];

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
    else ctx.rect(x, y, w, h);
}

function rectPath(ctx: Ctx, k: number, r: Rect, radius = 0) {
    rr(ctx, r.f0 * k, r.s0 * k, (r.f1 - r.f0) * k, (r.s1 - r.s0) * k, radius * k);
}

function fillRect(ctx: Ctx, k: number, r: Rect, color: string, radius = 0) {
    rectPath(ctx, k, r, radius);
    ctx.fillStyle = color;
    ctx.fill();
}

function polyPath(ctx: Ctx, k: number, pts: Pt[]) {
    ctx.beginPath();
    pts.forEach(([f, s], i) => (i ? ctx.lineTo(f * k, s * k) : ctx.moveTo(f * k, s * k)));
    ctx.closePath();
}

function linePath(ctx: Ctx, k: number, pts: Pt[]) {
    ctx.beginPath();
    pts.forEach(([f, s], i) => (i ? ctx.lineTo(f * k, s * k) : ctx.moveTo(f * k, s * k)));
}

const grow = (r: Rect, d: number): Rect => ({ f0: r.f0 - d, f1: r.f1 + d, s0: r.s0 - d, s1: r.s1 + d });
const sq = (f: number, s: number, h: number): Rect => ({ f0: f - h, f1: f + h, s0: s - h, s1: s + h });

function drawWheel(ctx: Ctx, k: number, side: -1 | 1) {
    const { radius: R, width: W, s } = LAYOUT.wheel;
    const s0 = side * s - W / 2;
    rr(ctx, -R * k, s0 * k, 2 * R * k, W * k, 0.4 * k);
    ctx.fillStyle = C.tire;
    ctx.fill();
}

function drawMotor(ctx: Ctx, k: number, r: Rect, side: -1 | 1) {
    const g = LAYOUT.gearboxLen;
    const can: Rect = side === 1 ? { ...r, s1: r.s1 - g } : { ...r, s0: r.s0 + g };
    const box: Rect = side === 1 ? { ...r, s0: r.s1 - g } : { ...r, s1: r.s0 + g };
    fillRect(ctx, k, can, C.motorCan, 0.25);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect((can.f0 + 0.3) * k, (can.s0 + 0.15) * k, 0.3 * k, (can.s1 - can.s0 - 0.3) * k);
    fillRect(ctx, k, box, C.gearbox, 0.15);
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = Math.max(1, 0.08 * k);
    for (let i = 1; i < 4; i++) {
        const s = box.s0 + (i * (box.s1 - box.s0)) / 4;
        ctx.beginPath();
        ctx.moveTo(box.f0 * k, s * k);
        ctx.lineTo(box.f1 * k, s * k);
        ctx.stroke();
    }
    // Shaft through to the wheel
    ctx.fillStyle = '#4b5563';
    const shaftS = side === 1 ? r.s1 : r.s0 - 0.3;
    ctx.fillRect(-0.15 * k, shaftS * k, 0.3 * k, 0.3 * k);
}

function drawBattery(ctx: Ctx, k: number) {
    const b = LAYOUT.battery;
    fillRect(ctx, k, b, C.batt, 0.2);
    rectPath(ctx, k, b, 0.2);
    ctx.strokeStyle = C.battEdge;
    ctx.lineWidth = Math.max(1, 0.1 * k);
    ctx.stroke();
    // Balance + power leads
    ctx.fillStyle = '#dc2626';
    ctx.fillRect((b.f0 + 0.3) * k, (b.s1 - 0.05) * k, 0.25 * k, 0.4 * k);
    ctx.fillStyle = '#111827';
    ctx.fillRect((b.f0 + 0.65) * k, (b.s1 - 0.05) * k, 0.25 * k, 0.4 * k);
}

function drawNano(ctx: Ctx, k: number, ledOn: boolean) {
    const r = LAYOUT.nano;
    ctx.fillStyle = '#111827';
    ctx.fillRect((r.f0 - 0.05) * k, r.s0 * k, 0.35 * k, (r.s1 - r.s0) * k);
    ctx.fillRect((r.f1 - 0.3) * k, r.s0 * k, 0.35 * k, (r.s1 - r.s0) * k);
    fillRect(ctx, k, r, C.nano, 0.1);
    ctx.fillStyle = '#fbbf24';
    for (let i = 0; i < 15; i++) {
        const s = r.s0 + 0.2 + i * ((r.s1 - r.s0 - 0.4) / 14);
        ctx.fillRect((r.f0 + 0.1) * k, (s - 0.05) * k, 0.12 * k, 0.12 * k);
        ctx.fillRect((r.f1 - 0.22) * k, (s - 0.05) * k, 0.12 * k, 0.12 * k);
    }
    ctx.save();
    ctx.translate(((r.f0 + r.f1) / 2) * k, 0.1 * k);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = C.chip;
    ctx.fillRect(-0.4 * k, -0.4 * k, 0.8 * k, 0.8 * k);
    ctx.restore();
    fillRect(ctx, k, { f0: r.f0 + 0.55, f1: r.f1 - 0.55, s0: r.s1 - 0.6, s1: r.s1 + 0.15 }, C.usb, 0.05);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect((r.f0 + 0.6) * k, (r.s0 + 0.6) * k, 0.4 * k, 0.4 * k);
    ctx.beginPath();
    ctx.arc((r.f1 - 0.55) * k, (r.s0 + 0.8) * k, 0.14 * k, 0, Math.PI * 2);
    ctx.fillStyle = ledOn ? '#fb923c' : '#7f1d1d';
    ctx.fill();
}

// The OLED sits on top of the battery; its 4 header pins (GND VCC SCL SDA)
// bend down to the PCB in front of the battery.
function drawOled(ctx: Ctx, k: number) {
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.4)';
    ctx.shadowBlur = 0.5 * k;
    fillRect(ctx, k, LAYOUT.oled, '#1e3a8a', 0.15);
    ctx.restore();
    const pins = LAYOUT.oledPins;
    fillRect(ctx, k, pins, '#111827', 0.03);
    ctx.fillStyle = '#fbbf24';
    for (let i = 0; i < 4; i++) {
        const s = pins.s0 + 0.25 + i * ((pins.s1 - pins.s0 - 0.5) / 3);
        ctx.fillRect((pins.f0 + 0.07) * k, (s - 0.06) * k, 0.12 * k, 0.12 * k);
    }
    const sc = LAYOUT.oledScreen;
    fillRect(ctx, k, sc, C.oled, 0.02);
}

function drawOledPicture(ctx: Ctx, k: number, oled: HTMLCanvasElement | null | undefined) {
    const sc = LAYOUT.oledScreen;
    if (!oled) return;
    // Screen picture: its x runs to the robot's right, its top faces forward
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.transform(0, ((sc.s1 - sc.s0) / oled.width) * k, -((sc.f1 - sc.f0) / oled.height) * k, 0, sc.f1 * k, sc.s0 * k);
    ctx.drawImage(oled, 0, 0);
    ctx.restore();
}

function drawBoard(ctx: Ctx, k: number) {
    polyPath(ctx, k, LAYOUT.board);
    ctx.fillStyle = C.board;
    ctx.fill();
    ctx.strokeStyle = C.boardEdge;
    ctx.lineWidth = Math.max(1, 0.12 * k);
    ctx.stroke();
    for (const [f, s] of LAYOUT.screws) {
        ctx.beginPath();
        ctx.arc(f * k, s * k, 0.3 * k, 0, Math.PI * 2);
        ctx.fillStyle = '#cbd5e1';
        ctx.fill();
    }
    fillRect(ctx, k, LAYOUT.boardHeader, '#111827', 0.05);
}

function drawButtons(ctx: Ctx, k: number) {
    for (const b of LAYOUT.buttons) {
        ctx.fillStyle = '#1f2937';
        ctx.fillRect((b.f - 0.45) * k, (b.s - 0.45) * k, 0.9 * k, 0.9 * k);
        ctx.beginPath();
        ctx.arc(b.f * k, b.s * k, 0.27 * k, 0, Math.PI * 2);
        ctx.fillStyle = C.button;
        ctx.fill();
    }
}

function drawSwitches(ctx: Ctx, k: number, states: boolean[]) {
    LAYOUT.switches.forEach((sw, i) => {
        const on = states[i];
        fillRect(ctx, k, sq(sw.f, sw.s, 0.55), '#334155', 0.12);
        fillRect(ctx, k, sq(sw.f, sw.s, on ? 0.33 : 0.42), on ? '#cbd5e1' : C.switch, 0.08);
        // Status dot next to the switch: green = ON
        ctx.beginPath();
        ctx.arc((sw.f + 0.75) * k, sw.s * k, 0.14 * k, 0, Math.PI * 2);
        ctx.fillStyle = on ? '#22c55e' : '#475569';
        ctx.fill();
    });
}

function drawDriver(ctx: Ctx, k: number) {
    const r = LAYOUT.driver;
    fillRect(ctx, k, r, C.driver, 0.05);
    ctx.fillStyle = '#9ca3af';
    for (let i = 0; i < 4; i++) {
        const s = r.s0 + 0.15 + i * ((r.s1 - r.s0 - 0.3) / 3);
        ctx.fillRect((r.f0 - 0.12) * k, (s - 0.05) * k, 0.12 * k, 0.1 * k);
        ctx.fillRect(r.f1 * k, (s - 0.05) * k, 0.12 * k, 0.1 * k);
    }
}

function drawSensorBoard(ctx: Ctx, k: number, sensors: Sensors) {
    const sb = sensorBoardShape(sensors);
    fillRect(ctx, k, sb.stem, C.neck, 0.2);
    for (const w of sb.wings) {
        polyPath(ctx, k, w);
        ctx.fillStyle = C.sensorPcb;
        ctx.fill();
    }
    linePath(ctx, k, sb.bar);
    ctx.strokeStyle = C.sensorPcb;
    ctx.lineWidth = BAR_WIDTH * k;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    for (const [f, s] of sb.holes) {
        ctx.beginPath();
        ctx.arc(f * k, s * k, 0.32 * k, 0, Math.PI * 2);
        ctx.fillStyle = '#d4a017';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(f * k, s * k, 0.16 * k, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
        ctx.fill();
    }
    fillRect(ctx, k, sb.header, '#111827', 0.05);
    fillRect(ctx, k, sb.mux, C.chip, 0.05);
    // Each channel: red LED emitter + photodiode, plus a small SMD resistor
    for (const p of sensors) {
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect((p.f - 0.85) * k, (p.s - 0.12) * k, 0.3 * k, 0.24 * k);
        ctx.beginPath();
        ctx.arc((p.f + 0.45) * k, p.s * k, 0.3 * k, 0, Math.PI * 2);
        ctx.fillStyle = C.emitter;
        ctx.fill();
        ctx.beginPath();
        ctx.arc((p.f - 0.3) * k, p.s * k, 0.26 * k, 0, Math.PI * 2);
        ctx.fillStyle = '#334155';
        ctx.fill();
    }
}

// Grey ribbon cable along the neck, from the body to the sensor bar
function drawRibbon(ctx: Ctx, k: number, sensors: Sensors) {
    const header = sensorBoardShape(sensors).header;
    const r: Rect = { f0: LAYOUT.boardHeader.f1 - 0.1, f1: header.f0 + 0.15, s0: -0.6, s1: 0.6 };
    fillRect(ctx, k, r, C.ribbon, 0.02);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(0.5, 0.04 * k);
    for (let i = 1; i < 8; i++) {
        const s = r.s0 + (i * (r.s1 - r.s0)) / 8;
        ctx.beginPath();
        ctx.moveTo(r.f0 * k, s * k);
        ctx.lineTo(r.f1 * k, s * k);
        ctx.stroke();
    }
}

// Outline of each part, used for the Learn-mode highlight
function partOutline(ctx: Ctx, k: number, part: PartId, sensors: Sensors) {
    const L = LAYOUT;
    const rects: Rect[] = [];
    switch (part) {
        case 'battery': rects.push(L.battery); break;
        case 'nano': rects.push(L.nano); break;
        case 'driver': rects.push(L.driver); break;
        case 'motors': rects.push(L.motorL, L.motorR); break;
        case 'oled': rects.push(L.oled); break;
        case 'mux': rects.push(sensorBoardShape(sensors).mux); break;
        case 'switch': for (const sw of L.switches) rects.push(sq(sw.f, sw.s, 0.55)); break;
        case 'buttons': for (const b of L.buttons) rects.push(sq(b.f, b.s, 0.45)); break;
        case 'wheels': {
            const { radius: R, width: W, s } = L.wheel;
            rects.push({ f0: -R, f1: R, s0: -s - W / 2, s1: -s + W / 2 }, { f0: -R, f1: R, s0: s - W / 2, s1: s + W / 2 });
            break;
        }
        case 'caster':
            for (const [f, s] of sensorBoardShape(sensors).holes) {
                ctx.beginPath();
                ctx.arc(f * k, s * k, 0.65 * k, 0, Math.PI * 2);
                ctx.stroke();
            }
            return;
        case 'chassis':
            polyPath(ctx, k, L.board);
            ctx.stroke();
            return;
        case 'sensors': {
            const sb = sensorBoardShape(sensors);
            ctx.globalAlpha *= 0.45;
            linePath(ctx, k, sb.bar);
            ctx.lineWidth = (BAR_WIDTH + 0.5) * k;
            ctx.stroke();
            for (const w of sb.wings) { polyPath(ctx, k, w); ctx.fill(); }
            rectPath(ctx, k, grow(sb.stem, 0.2), 0.3);
            ctx.fill();
            return;
        }
    }
    for (const r of rects) {
        rectPath(ctx, k, grow(r, 0.2), 0.3);
        ctx.stroke();
    }
}

// Everything that never changes is drawn once into a cached sprite (2x for
// sharpness); each frame then draws one image plus the few live parts.
const SPRITE_PAD = 1.5; // cm, room for the soft shadow
const SPRITE_SCALE = 2;
const spriteCache = new Map<string, HTMLCanvasElement>();

function drawStatic(ctx: Ctx, k: number, sensors: Sensors) {
    const L = LAYOUT;
    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.35)';
    ctx.shadowBlur = 1.0 * k;
    ctx.shadowOffsetX = 0.3 * k;
    ctx.shadowOffsetY = 0.3 * k;
    polyPath(ctx, k, L.board);
    ctx.fillStyle = C.board;
    ctx.fill();
    ctx.restore();

    drawSensorBoard(ctx, k, sensors);
    drawBoard(ctx, k);
    drawRibbon(ctx, k, sensors);
    drawWheel(ctx, k, -1);
    drawWheel(ctx, k, 1);
    drawMotor(ctx, k, L.motorL, -1);
    drawMotor(ctx, k, L.motorR, 1);
    drawBattery(ctx, k);
    drawOled(ctx, k);
    drawDriver(ctx, k);
    drawButtons(ctx, k);
    drawNano(ctx, k, false);
}

function bodySprite(k: number, sensors: Sensors): HTMLCanvasElement {
    const key = k.toFixed(4) + '|' + sensors.map(p => `${p.f.toFixed(2)},${p.s.toFixed(2)}`).join(';');
    let sprite = spriteCache.get(key);
    if (!sprite) {
        const B = LAYOUT_BOUNDS;
        const K = k * SPRITE_SCALE;
        sprite = document.createElement('canvas');
        sprite.width = Math.ceil((B.f1 - B.f0 + 2 * SPRITE_PAD) * K);
        sprite.height = Math.ceil((B.s1 - B.s0 + 2 * SPRITE_PAD) * K);
        const c = sprite.getContext('2d')!;
        c.translate(-(B.f0 - SPRITE_PAD) * K, -(B.s0 - SPRITE_PAD) * K);
        drawStatic(c, K, sensors);
        if (spriteCache.size > 4) spriteCache.clear(); // track scale changed a few times
        spriteCache.set(key, sprite);
    }
    return sprite;
}

export function drawRobotBody(ctx: Ctx, o: Draw2DOptions) {
    const k = o.ppc;
    const B = LAYOUT_BOUNDS;
    const sprite = bodySprite(k, o.sensors);
    ctx.drawImage(sprite, (B.f0 - SPRITE_PAD) * k, (B.s0 - SPRITE_PAD) * k, sprite.width / SPRITE_SCALE, sprite.height / SPRITE_SCALE);

    // Live parts
    drawOledPicture(ctx, k, o.oled);
    drawSwitches(ctx, k, [o.powerOn ?? true, o.motorOn ?? true]);
    if (o.ledOn) {
        const r = LAYOUT.nano;
        ctx.beginPath();
        ctx.arc((r.f1 - 0.55) * k, (r.s0 + 0.8) * k, 0.14 * k, 0, Math.PI * 2);
        ctx.fillStyle = '#fb923c';
        ctx.fill();
    }

    if (o.highlight) {
        const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 180);
        ctx.save();
        ctx.strokeStyle = C.highlight;
        ctx.fillStyle = C.highlight;
        ctx.lineWidth = Math.max(2, 0.3 * k);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = C.highlight;
        ctx.shadowBlur = 0.8 * k * pulse;
        ctx.globalAlpha = 0.5 + 0.5 * pulse;
        partOutline(ctx, k, o.highlight, o.sensors);
        ctx.restore();
    }
}
