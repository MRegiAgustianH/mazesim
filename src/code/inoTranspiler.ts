// Turns the small C++ subset used in mrbMaze sketches into async JavaScript the
// simulator can run: setup()/loop(), own functions, int/float/bool variables,
// if/for/while, `my.*` library calls and delay(). Anything beyond that (arrays,
// structs, pointers, classes) is not supported.

import { beep } from '../simulator/beep';
import type { Robot } from '../simulator/Robot';

const TYPES = [
    'unsigned\\s+long', 'unsigned\\s+int', 'unsigned\\s+char', 'long\\s+long',
    'int', 'long', 'short', 'float', 'double', 'bool', 'boolean', 'byte', 'char', 'word', 'String',
    'u?int(?:8|16|32|64)_t', 'size_t',
].join('|');
const TYPE_RE = `(?:const\\s+|static\\s+|volatile\\s+)*(?:${TYPES}|void)`;

export class SketchEnd extends Error {
    constructor() { super('my.end()'); }
}

// Blank out comments and strings (same length) so the regexes below never
// match inside them; the real text is restored afterwards.
function mask(src: string): { masked: string; restore: (s: string) => string } {
    const saved: string[] = [];
    const masked = src.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, (m) => {
        saved.push(m);
        // keep newlines so line numbers in errors still match
        return `${saved.length - 1}` + m.replace(/[^\n]/g, '');
    });
    return {
        masked,
        restore: (s) => s.replace(/(\d+)/g, (_, i) => {
            const m = saved[Number(i)];
            return m.startsWith('/*') ? m.replace(/\n/g, ' ') : m;
        }),
    };
}

// Insert `await __tick();` as the first statement of every for/while body so
// a busy loop with no library call still lets the page breathe.
function addLoopTicks(code: string): string {
    let out = '';
    let i = 0;
    const re = /\b(for|while)\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code))) {
        let depth = 0;
        let j = m.index + m[0].length - 1;
        for (; j < code.length; j++) {
            if (code[j] === '(') depth++;
            else if (code[j] === ')' && --depth === 0) break;
        }
        let k = j + 1;
        while (k < code.length && /\s/.test(code[k])) k++;
        if (code[k] === '{') {
            out += code.slice(i, k + 1) + ' await __tick();';
            i = k + 1;
        } else if (code[k] === ';') {
            // `while (cond);` -> give it a body
            out += code.slice(i, k) + '{ await __tick(); }';
            i = k + 1;
        } else {
            out += code.slice(i, k) + '{ await __tick(); ';
            const end = code.indexOf(';', k);
            out += code.slice(k, end + 1) + ' }';
            i = end + 1;
        }
        re.lastIndex = i;
    }
    return out + code.slice(i);
}

export function transpileIno(src: string): string {
    const { masked, restore } = mask(src);
    let c = masked;

    // Preprocessor lines and the library object declaration
    c = c.replace(/^[ \t]*#[^\n]*/gm, '');
    c = c.replace(/^[ \t]*mrbMaze\d+\s+\w+\s*;/gm, '');

    // Function prototypes: `void turn(int p);`
    c = c.replace(new RegExp(`^[ \\t]*${TYPE_RE}(?:\\s+|\\s*\\*\\s*)\\w+\\s*\\([^)]*\\)\\s*;`, 'gm'), '');

    // Function definitions
    const fnNames: string[] = [];
    c = c.replace(new RegExp(`\\b${TYPE_RE}(?:\\s+|\\s*\\*\\s*)(\\w+)\\s*\\(([^)]*)\\)\\s*\\{`, 'g'), (_m, name: string, params: string) => {
        fnNames.push(name);
        const args = params.trim() === '' || params.trim() === 'void' ? '' : params.split(',').map(p => {
            const parts = p.trim().replace(/[&*]/g, ' ').split(/\s+/);
            const last = parts[parts.length - 1];
            return last.split('=')[0];
        }).join(', ');
        return `async function ${name}(${args}) {`;
    });

    // Casts like (int)x
    c = c.replace(new RegExp(`\\(\\s*(?:${TYPES})\\s*\\)`, 'g'), '');
    // Variable declarations -> let
    c = c.replace(new RegExp(`\\b${TYPE_RE}\\s+(?=[A-Za-z_])`, 'g'), 'let ');
    // C++ library calls and Arduino builtins
    c = c.replace(/\bmy\s*\.\s*(\w+)\s*\(/g, 'await my.$1(');
    c = c.replace(/(?<![\w.])delay\s*\(/g, 'await my.delay(');
    c = c.replace(/\bSerial\s*\.\s*(?:begin|print|println)\s*\(/g, 'Serial(');
    // Own function calls
    for (const name of fnNames) {
        c = c.replace(new RegExp(`(?<!function |[\\w.])${name}\\s*\\(`, 'g'), `await ${name}(`);
    }

    c = addLoopTicks(c);
    c = restore(c);

    if (!fnNames.includes('loop') && !fnNames.includes('setup')) {
        throw new Error('setup() / loop() not found');
    }
    return `${c}
;if (typeof setup === 'function') await setup();
if (typeof loop === 'function') { while (true) { await loop(); await __tick(); } }
`;
}

export function compileIno(src: string): (my: unknown, rt: Runtime) => Promise<void> {
    const js = transpileIno(src);
    const AsyncFunction = Object.getPrototypeOf(async function () { /* */ }).constructor;
    return new AsyncFunction('my', '__rt', `const { __tick, millis, micros, Serial, HIGH, LOW, constrain, map, abs, min, max, random } = __rt;\n${js}`);
}

interface Runtime {
    __tick: () => Promise<void>;
    millis: () => number;
    micros: () => number;
    Serial: (...a: unknown[]) => void;
    HIGH: number;
    LOW: number;
    constrain: (x: number, a: number, b: number) => number;
    map: (x: number, a: number, b: number, c: number, d: number) => number;
    abs: (x: number) => number;
    min: (a: number, b: number) => number;
    max: (a: number, b: number) => number;
    random: (a: number, b?: number) => number;
}

// The `my` object the sketch talks to. Library setup calls that have no effect
// in the simulator resolve right away.
export function createSketchRuntime(robot: Robot): { my: unknown; rt: Runtime } {
    const t0 = performance.now();
    let ticks = 0;
    const withBeep = (fn: (...a: number[]) => Promise<unknown>) => async (...a: number[]) => {
        const r = await fn(...a);
        if (robot._isSimulationRunning) beep();
        return r;
    };
    const noop = async () => { await robot.checkStop(); };
    const my: Record<string, (...a: number[]) => Promise<unknown>> = {
        mazeSetup: () => robot.mazeSetup(),
        welcomeScreen: noop,
        motorBalance: noop,
        sensorSet: noop,
        pidSet: noop,
        lineColour: (c) => robot.lc(c),
        lc: (c) => robot.lc(c),
        start: async () => { await robot.checkStop(); await robot.sleep(500); },
        end: async () => { await robot.checkStop(); robot.lSpeed = 0; robot.rSpeed = 0; throw new SketchEnd(); },
        senTest: noop,
        battTest: noop,
        motorDrive: async (l, r) => { await robot.checkStop(); robot.lSpeed = l; robot.rSpeed = r; await robot.sleep(0); },
        motor: withBeep((l, r, d) => robot.motor(l, r, d)),
        tright: withBeep((p) => robot.tright(p)),
        tleft: withBeep((p) => robot.tleft(p)),
        ld: withBeep((p, d) => robot.ld(p, d)),
        lineTrace: withBeep((p) => robot.lineTrace(p)),
        lineTraceSmooth: withBeep((p) => robot.lineTraceSmooth(p)),
        trigger: withBeep((p, s, st) => robot.trigger(p, s, st)),
        sac: withBeep((p) => robot.sac(p)),
        rl: withBeep((p, s) => robot.rl(p, s)),
        ll: withBeep((p, s) => robot.ll(p, s)),
        prl: withBeep((p, s) => robot.prl(p, s)),
        pll: withBeep((p, s) => robot.pll(p, s)),
        rls: withBeep((p, s, st) => robot.rls(p, s, st)),
        lls: withBeep((p, s, st) => robot.lls(p, s, st)),
        rld: withBeep((p, s, st, d) => robot.rld(p, s, st, d)),
        lld: withBeep((p, s, st, d) => robot.lld(p, s, st, d)),
        pickup: withBeep((g, l, s, d) => robot.pickup(g, l, s, d)),
        pu: withBeep((g, l, s, d) => robot.pickup(g, l, s, d)),
        putdown: withBeep((s, d) => robot.putdown(s, d)),
        pd: withBeep((s, d) => robot.putdown(s, d)),
        blink: withBeep(() => robot.blink()),
        delay: (ms) => robot.delay(ms),
    };
    const proxy = new Proxy(my, {
        get(target, prop: string) {
            if (prop in target) return target[prop];
            return () => Promise.reject(new Error(`my.${prop}() is not available in the simulator`));
        },
    });
    const rt: Runtime = {
        __tick: async () => {
            await robot.checkStop();
            if (++ticks % 200 === 0) await new Promise(r => setTimeout(r, 0));
        },
        millis: () => Math.floor(performance.now() - t0),
        micros: () => Math.floor((performance.now() - t0) * 1000),
        Serial: (...a) => console.log('[Serial]', ...a),
        HIGH: 1,
        LOW: 0,
        constrain: (x, a, b) => Math.min(Math.max(x, a), b),
        map: (x, a, b, c, d) => Math.trunc((x - a) * (d - c) / (b - a) + c),
        abs: Math.abs,
        min: Math.min,
        max: Math.max,
        random: (a, b) => b === undefined ? Math.floor(Math.random() * a) : Math.floor(a + Math.random() * (b - a)),
    };
    return { my: proxy, rt };
}
