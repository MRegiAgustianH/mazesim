// OLED bitmaps taken straight from the mrbMaze library sources, so the
// simulator shows exactly what the robot's firmware draws.
import cpp42 from '../../mrbMaze42/mrbMaze42.cpp?raw';
import cpp44 from '../../mrbMaze44/mrbMaze44.cpp?raw';
import type { LibVersion } from '../blockly/inoTemplate';

export interface Bitmap { data: Uint8Array; w: number; h: number; }

// Sizes as used in the drawBitmap() calls of the library
const SIZES: Record<string, [number, number]> = {
    myrobo: [128, 44],
    startMode: [100, 58],
    speedTest: [86, 48],
    sensorCalibrate: [107, 49],
    gripper: [88, 46],
    batt: [15, 8],
    motorTest: [64, 25],
    forward: [10, 17],
    backward: [10, 17],
    barV: [8, 1],
};

function parse(src: string): Record<string, Bitmap> {
    const out: Record<string, Bitmap> = {};
    const re = /const\s+unsigned\s+char\s+(\w+)\s*\[\]\s*PROGMEM\s*=\s*\{([^}]*)\}/g;
    for (const m of src.matchAll(re)) {
        const size = SIZES[m[1]];
        if (!size) continue;
        const bytes = (m[2].match(/0x[0-9a-fA-F]{1,2}/g) ?? []).map(h => parseInt(h, 16));
        out[m[1]] = { data: Uint8Array.from(bytes), w: size[0], h: size[1] };
    }
    return out;
}

const parsed: Partial<Record<LibVersion, Record<string, Bitmap>>> = {};
export function bitmaps(v: LibVersion): Record<string, Bitmap> {
    return (parsed[v] ??= parse(v === '44' ? cpp44 : cpp42));
}
