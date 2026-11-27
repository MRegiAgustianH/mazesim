// Arduino sketch template for the two library versions. The setup() follows
// each library's own example sketch (mrbMaze42/examples, mrbMaze44/examples).

export type LibVersion = '42' | '44';

export const LIB_VERSIONS: { id: LibVersion; label: string }[] = [
    { id: '42', label: 'mrbMaze 4.2' },
    { id: '44', label: 'mrbMaze 4.4' },
];

// Gripper functions were renamed in 4.4: pickup/putdown -> pu/pd
export const gripperFn = (v: LibVersion) => (v === '44' ? { pickup: 'pu', putdown: 'pd' } : { pickup: 'pickup', putdown: 'putdown' });

function setupBlock(v: LibVersion): string {
    if (v === '44') {
        return `void setup() {
  my.mazeSetup();
  // my.welcomeScreen();
  my.motorBalance(0,0);
  my.sensorSet(300, 300, 300, 300, 300, 300, 300, 300);
  my.pidSet(28,8,8);
  my.lineColour(0);     // 0 for black line, 1 for white line
  my.start();
}

/*
  my.pu(100,100,3,300);  gripPower, liftHigh, speed, delay
  my.pd(3,300);      speed, delay
*/`;
    }
    return `void setup() {
  my.mazeSetup();
  my.welcomeScreen();
  my.sensorSet(300, 300, 300, 300, 300, 300, 300, 300);
  my.pidSet(28,8,8);
  my.lineColour(0);     // 0 for black line, 1 for white line
  my.start();
}

/*
  my.pickup(100,100,3,300);	gripPower, liftHigh, speed, delay
  my.putdown(3,300);			speed, delay
*/`;
}

// Rewrite a sketch written for one library version for the other, keeping the
// user's own code: header and object type, the template setup() (only when it
// is still the untouched template), gripper names, and motorBalance (4.4 only).
export function convertSketch(code: string, from: LibVersion, to: LibVersion): string {
    if (from === to) return code;
    let out = code
        .replace(new RegExp(`#include\\s*<mrbMaze${from}\\.h>`, 'g'), `#include <mrbMaze${to}.h>`)
        .replace(new RegExp(`\\bmrbMaze${from}(\\s+\\w+\\s*;)`, 'g'), `mrbMaze${to}$1`)
        .replace(setupBlock(from), setupBlock(to));
    const [a, b] = [gripperFn(from), gripperFn(to)];
    out = out
        .replace(new RegExp(`\\bmy\\s*\\.\\s*${a.pickup}\\s*\\(`, 'g'), `my.${b.pickup}(`)
        .replace(new RegExp(`\\bmy\\s*\\.\\s*${a.putdown}\\s*\\(`, 'g'), `my.${b.putdown}(`);
    if (to === '42') out = out.replace(/^[ \t]*my\s*\.\s*motorBalance\s*\([^)]*\)\s*;[^\n]*\n/gm, '');
    return out;
}

// `body` is the code inside loop(); `notes` are extra comment lines placed
// before "start code here".
export function inoSketch(v: LibVersion, body: string, notes: string[] = []): string {
    const name = `mrbMaze${v}`;
    const noteLines = notes.map(n => `  // ${n}\n`).join('');
    return `#include <${name}.h>
${name} my;

${setupBlock(v)}

void loop() {
${noteLines}  // start code here ! -------------------------
${body}


  // end of code -------------------------------
  my.end();
}`;
}
