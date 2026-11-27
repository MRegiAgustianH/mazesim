// Suggestions for the Code tab: mrbMaze `my.*` functions (from the Library
// docs) and the Arduino words people type most.

import type { LibVersion } from '../blockly/inoTemplate';
import type { LibFunction } from '../learn/libraryDocs';

export interface Suggestion {
    label: string;       // what gets inserted (without parentheses)
    signature?: string;  // e.g. void motor(int lSpeed, int rSpeed, int dly)
    params?: string[];   // parameter names, for the hint while typing args
    detail?: string;     // one-line description
    kind: 'fn' | 'keyword';
}

// Functions that are Arduino builtins, not methods of `my`
const GLOBAL_FNS = new Set(['delay']);

const ARDUINO: Suggestion[] = [
    { label: 'millis', signature: 'unsigned long millis()', params: [], detail: 'Milliseconds since the sketch started.', kind: 'fn' },
    { label: 'micros', signature: 'unsigned long micros()', params: [], detail: 'Microseconds since the sketch started.', kind: 'fn' },
    { label: 'constrain', signature: 'constrain(x, a, b)', params: ['x', 'a', 'b'], detail: 'Limits x to the range a–b.', kind: 'fn' },
    { label: 'map', signature: 'long map(value, fromLow, fromHigh, toLow, toHigh)', params: ['value', 'fromLow', 'fromHigh', 'toLow', 'toHigh'], detail: 'Re-maps a number from one range to another.', kind: 'fn' },
    { label: 'abs', signature: 'abs(x)', params: ['x'], kind: 'fn' },
    { label: 'min', signature: 'min(a, b)', params: ['a', 'b'], kind: 'fn' },
    { label: 'max', signature: 'max(a, b)', params: ['a', 'b'], kind: 'fn' },
    { label: 'random', signature: 'long random(min, max)', params: ['min', 'max'], kind: 'fn' },
    ...['my', 'void', 'int', 'long', 'float', 'bool', 'unsigned', 'const', 'if', 'else', 'for', 'while', 'return', 'break', 'continue', 'true', 'false', 'HIGH', 'LOW']
        .map(label => ({ label, kind: 'keyword' as const })),
];

function paramNames(signature: string): string[] {
    const inside = signature.slice(signature.indexOf('(') + 1, signature.lastIndexOf(')')).trim();
    if (!inside) return [];
    return inside.split(',').map(p => p.trim().split(/\s+/).pop()!);
}

function rename(f: LibFunction, v: LibVersion): Suggestion {
    let { name, signature } = f;
    // 4.4 renamed the gripper functions
    if (v === '44' && (name === 'pickup' || name === 'putdown')) {
        const to = name === 'pickup' ? 'pu' : 'pd';
        signature = signature.replace(name, to);
        name = to;
    }
    return { label: name, signature, params: paramNames(signature), detail: f.summary, kind: 'fn' };
}

export function libSuggestions(lib: LibFunction[], v: LibVersion) {
    const my = lib
        .filter(f => !GLOBAL_FNS.has(f.name) && !(v === '42' && f.name === 'motorBalance'))
        .map(f => rename(f, v));
    const globals = [...lib.filter(f => GLOBAL_FNS.has(f.name)).map(f => rename(f, v)), ...ARDUINO];
    return { my, globals };
}

export function filterSuggestions(list: Suggestion[], prefix: string): Suggestion[] {
    const p = prefix.toLowerCase();
    const starts = list.filter(s => s.label.toLowerCase().startsWith(p));
    const contains = p ? list.filter(s => !s.label.toLowerCase().startsWith(p) && s.label.toLowerCase().includes(p)) : [];
    return [...starts, ...contains];
}

// What the caret is in the middle of typing
export function completionContext(before: string): { member: boolean; prefix: string } | null {
    const line = before.slice(before.lastIndexOf('\n') + 1);
    if (/\/\/|"/.test(line) || /^\s*#/.test(line)) return null; // comment, string, #include
    const m = line.match(/(\bmy\s*\.\s*)?([A-Za-z_]\w*)?$/)!;
    if (m[1]) return { member: true, prefix: m[2] ?? '' };
    if (m[2]) return { member: false, prefix: m[2] };
    return null;
}

// The call the caret is inside of, and which argument it is on
export function callContext(before: string): { name: string; member: boolean; arg: number } | null {
    const line = before.slice(before.lastIndexOf('\n') + 1);
    if (/\/\//.test(line)) return null;
    let depth = 0;
    let arg = 0;
    for (let i = line.length - 1; i >= 0; i--) {
        const ch = line[i];
        if (ch === ')') depth++;
        else if (ch === '(') {
            if (depth === 0) {
                const m = line.slice(0, i).match(/(\bmy\s*\.\s*)?([A-Za-z_]\w*)\s*$/);
                return m ? { name: m[2], member: !!m[1], arg } : null;
            }
            depth--;
        } else if (ch === ',' && depth === 0) arg++;
    }
    return null;
}
