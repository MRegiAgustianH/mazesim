import type { PartId } from '../simulator/robotLayout';

// Reference for every mrbMaze42 function. "How it works" follows
// mrbMaze42.cpp; `sim` notes where the simulator behaves differently.

export interface Param { name: string; type: string; range?: string; desc: string; }

export interface LibFunction {
    name: string;
    signature: string;
    category: CategoryId;
    summary: string;
    params: Param[];
    details: string[];
    example: string;
    block?: string; // Blockly block label
    parts: PartId[];
    sim?: string;
}

export type CategoryId = 'setup' | 'motion' | 'line' | 'junction' | 'utility' | 'gripper';

export const CATEGORIES: { id: CategoryId; label: string; desc: string }[] = [
    { id: 'setup', label: 'Setup', desc: 'Called once in setup() to prepare the robot.' },
    { id: 'motion', label: 'Motors & turns', desc: 'Drive the wheels directly.' },
    { id: 'line', label: 'Line following', desc: 'Follow the line with PID steering.' },
    { id: 'junction', label: 'Junctions', desc: 'Follow until a junction, then turn or pass it.' },
    { id: 'utility', label: 'Utility', desc: 'LED, timing, sensors and battery.' },
    { id: 'gripper', label: 'Gripper (optional)', desc: 'Servo arm on pins 7 and 8.' },
];

const POWER: Param = { name: 'power', type: 'int', range: '0–255', desc: 'Base motor speed (PWM). 80–150 is a good starting range.' };
const STEP: Param = { name: 'step', type: 'int', range: 'ms', desc: 'Time to drive straight after the junction is detected, so the wheels reach the crossing before turning. At power 100: 100 is smooth, 120 puts the axle right on the crossing.' };
const SENSOR: Param = { name: 'sensor', type: 'int', range: '11–88', desc: 'Two sensor numbers written as one number, e.g. 18 = sensors 1 and 8, 77 = sensor 7 only.' };

export const LIBRARY: LibFunction[] = [
    // ---------------- Setup
    {
        name: 'mazeSetup', signature: 'void mazeSetup()', category: 'setup',
        summary: 'Prepares all pins, the OLED, the servos, and stops the motors.',
        params: [],
        details: [
            'Sets the sensor-select, LED and motor-direction pins as outputs and the 4 buttons as INPUT_PULLUP.',
            'Starts the SSD1306 display on I²C address 0x3C, calls motorDrive(0, 0) and moves the gripper servos to "up / open".',
            'Always the first call in setup().',
        ],
        example: 'void setup() {\n  my.mazeSetup();\n}',
        block: 'mrbMaze42 Setup', parts: ['nano', 'oled', 'driver'],
    },
    {
        name: 'motorBalance', signature: 'void motorBalance(int l, int r)', category: 'setup',
        summary: 'Version 4.4 only: trims the speed of each motor so the robot drives straight.',
        params: [
            { name: 'l', type: 'int', desc: 'Correction for the left motor PWM.' },
            { name: 'r', type: 'int', desc: 'Correction for the right motor PWM.' },
        ],
        details: [
            'motorDrive() subtracts these values from the PWM it writes, so a positive value changes that motor’s speed a little on every move.',
            'Start with motorBalance(0,0). If the robot drifts on motor(150, 150, 1000), adjust one side a few units at a time.',
            'The 4.4 example calls it in setup() instead of welcomeScreen().',
        ],
        example: 'my.motorBalance(0,0);',
        parts: ['motors', 'driver'],
        sim: 'The simulator motors are identical, so no balance is needed.',
    },
    {
        name: 'welcomeScreen', signature: 'void welcomeScreen()', category: 'setup',
        summary: 'Shows the logo and a short loading bar on the OLED.',
        params: [],
        details: ['Purely cosmetic. Lights the pin-13 LED while it draws. Version 4.4 adds "4.4" in the corner, and its example sketch leaves this call commented out.'],
        example: 'my.welcomeScreen();',
        parts: ['oled'],
    },
    {
        name: 'sensorSet', signature: 'void sensorSet(int s1, int s2, int s3, int s4, int s5, int s6, int s7, int s8)', category: 'setup',
        summary: 'Sets the threshold for each of the 8 sensors.',
        params: [
            { name: 's1 … s8', type: 'int', range: '0–1023', desc: 'Threshold per sensor, left to right. A reading above the threshold counts as dark.' },
        ],
        details: [
            'senTest() compares every raw reading with these values. Pick a value halfway between what a sensor reads on the floor and on the line.',
            'Example: a sensor reads 120 on white and 650 on black → threshold ≈ 385.',
        ],
        example: 'my.sensorSet(300, 300, 300, 300, 300, 300, 300, 300);',
        parts: ['sensors'],
        sim: 'The simulator uses ideal sensors (pixel brightness), so these thresholds have no effect here.',
    },
    {
        name: 'pidSet', signature: 'void pidSet(int kp, int ki, int kd)', category: 'setup',
        summary: 'Sets the PID gains used by every line-following function.',
        params: [
            { name: 'kp', type: 'int', desc: 'Proportional gain: how hard to steer for a given error.' },
            { name: 'ki', type: 'int', desc: 'Integral-like gain applied to (error + last error).' },
            { name: 'kd', type: 'int', desc: 'Derivative gain applied to (error − last error). Damps wobbling.' },
        ],
        details: [
            'The gains are scaled by power / 250, so the same values work at different speeds.',
            'Default generated code: pidSet(28, 8, 8). Raise kp if the robot misses curves, raise kd if it wobbles on straights.',
        ],
        example: 'my.pidSet(28, 8, 8);',
        parts: ['nano'],
        sim: 'The simulator always uses 28, 8, 8.',
    },
    {
        name: 'lineColour', signature: 'void lineColour(int col)', category: 'setup',
        summary: 'Chooses a dark line on a light floor, or a light line on a dark floor.',
        params: [{ name: 'col', type: 'int', range: '0 or 1', desc: '0 = black/dark line, 1 = white/light line.' }],
        details: ['You can switch in the middle of a run, for example when a track section has inverted colours.'],
        example: 'my.lineColour(0);  // black line\n// ... inverted section\nmy.lineColour(1);  // white line',
        block: 'Line Color (lc)', parts: ['sensors'],
    },
    {
        name: 'start', signature: 'void start()', category: 'setup',
        summary: 'Shows the menu and waits until you press OK on "Go".',
        params: [],
        details: [
            'UP / DOWN move through Go, Speed test, Sensor calibrate and Gripper. OK selects. The battery level is shown in the corner (version 4.2).',
            'When you choose Go it turns on the sensor LEDs (pin 6) and returns, and loop() starts.',
        ],
        example: 'my.start();  // last line of setup()',
        block: 'Wait for Start Button', parts: ['buttons', 'oled', 'sensors'],
        sim: 'The block just waits 0.5 s. Open the Robot panel to try the real menu.',
    },
    {
        name: 'end', signature: 'void end()', category: 'setup',
        summary: 'Turns off the sensors, blinks the LED and resets the Nano.',
        params: [],
        details: ['Placed at the end of loop() by the generator. After the reset the robot is back in the start() menu, ready for the next run.'],
        example: 'void loop() {\n  // route ...\n  my.end();\n}',
        parts: ['nano', 'sensors'],
    },

    // ---------------- Motors & turns
    {
        name: 'motor', signature: 'void motor(int lSpeed, int rSpeed, int dly)', category: 'motion',
        summary: 'Drives both wheels at the given speeds for dly ms, then stops.',
        params: [
            { name: 'lSpeed', type: 'int', range: '−255–255', desc: 'Left wheel. Negative = backward.' },
            { name: 'rSpeed', type: 'int', range: '−255–255', desc: 'Right wheel. Negative = backward.' },
            { name: 'dly', type: 'int', range: 'ms', desc: 'How long to drive.' },
        ],
        details: [
            'Equal speeds drive straight, different speeds curve, opposite speeds spin on the spot.',
            'No sensors are used, so it is "blind": good for short moves such as leaving the start box.',
        ],
        example: 'my.motor(150, 150, 500);   // forward 0.5 s\nmy.motor(120, -120, 250);  // spin right',
        block: 'Motor L / R / Wait', parts: ['motors', 'driver', 'wheels'],
        sim: 'With dly = 0 the simulator keeps the motors running until the next block. The real robot stops at once.',
    },
    {
        name: 'motorDrive', signature: 'void motorDrive(int lSpeed, int rSpeed)', category: 'motion',
        summary: 'Low-level: sets both motor speeds and returns immediately.',
        params: [
            { name: 'lSpeed', type: 'int', range: '−255–255', desc: 'Left wheel speed.' },
            { name: 'rSpeed', type: 'int', range: '−255–255', desc: 'Right wheel speed.' },
        ],
        details: [
            'Sets each DIR pin from the sign and writes the PWM pin. Every other movement function ends up here.',
            'The motors keep running until you call it again, so use it in your own loops in hand-written code.',
        ],
        example: 'my.motorDrive(100, 100);\ndelay(300);\nmy.motorDrive(0, 0);',
        parts: ['driver', 'motors'],
    },
    {
        name: 'tright', signature: 'void tright(int power)', category: 'motion',
        summary: 'Spins right on the spot until the sensors catch the next line.',
        params: [POWER],
        details: [
            'Left wheel forward, right wheel backward. First it waits until the sensor leaves the current line, then until it sees a line again, then stops.',
            'Because it stops on a line, the robot is already lined up for the next line-following function.',
        ],
        example: 'my.tright(100);',
        block: 'Turn Right (tright)', parts: ['motors', 'wheels', 'sensors'],
    },
    {
        name: 'tleft', signature: 'void tleft(int power)', category: 'motion',
        summary: 'Spins left on the spot until the sensors catch the next line.',
        params: [POWER],
        details: ['Mirror of tright(): left wheel backward, right wheel forward.'],
        example: 'my.tleft(100);',
        block: 'Turn Left (tleft)', parts: ['motors', 'wheels', 'sensors'],
    },

    // ---------------- Line following
    {
        name: 'lineTrace', signature: 'void lineTrace(float power)', category: 'line',
        summary: 'One PID line-following step: read sensors, steer, set motors.',
        params: [POWER],
        details: [
            'Reads the 8 sensors and looks up the error: 00011000 → 0, a line further left → +1 … +7, further right → −1 … −7.',
            'Any other pattern (no line, or 3+ sensors at a crossing) keeps the previous error, so the robot goes straight through junctions.',
            'pid = Kp·s·e + Ki·s·(e + e_last) + Kd·s·(e − e_last), with s = power / 250. Left = power − pid, right = power + pid, both capped at power.',
            'In firmware this is a single step. Call it in a loop.',
        ],
        example: 'while (true) {\n  my.lineTrace(120);\n}',
        block: 'Line Trace', parts: ['sensors', 'nano', 'motors'],
        sim: 'The simulator block keeps following until 6 or more sensors see the line (a crossing), then stops.',
    },
    {
        name: 'lineTraceSmooth', signature: 'void lineTraceSmooth(float power)', category: 'line',
        summary: 'lineTrace with a soft start the first time it is called.',
        params: [POWER],
        details: [
            'On the first call it ramps the speed from 40 up to power, so the wheels don’t slip and the robot doesn’t jerk off the line.',
            'After that it behaves exactly like lineTrace(). All junction functions use it internally.',
        ],
        example: 'my.lineTraceSmooth(150);',
        block: 'Line Trace Smooth', parts: ['sensors', 'motors'],
    },
    {
        name: 'ld', signature: 'void ld(int power, int dly)', category: 'line',
        summary: 'Follows the line for about dly milliseconds, then stops.',
        params: [POWER, { name: 'dly', type: 'int', range: 'ms', desc: 'Approximate time to follow the line.' }],
        details: [
            'Useful for straight sections without junctions, or to get past a junction you don’t want to count.',
            'Repeats lineTraceSmooth() about dly / 2 times; each step takes ≈ 2 ms.',
        ],
        example: 'my.ld(120, 800);',
        block: 'Line Delay (ld)', parts: ['sensors', 'motors'],
    },

    // ---------------- Junctions
    {
        name: 'rl', signature: 'void rl(int power, int step)', category: 'junction',
        summary: 'Follow the line, take the next RIGHT branch.',
        params: [POWER, STEP],
        details: [
            'Follows the line until the right side of the sensor bar sees a branch, drives forward for step ms, then calls tright().',
            'Version 4.4 detects the branch with sensor 8 alone. Version 4.2 uses a combination of the centre sensors and sensor 7.',
        ],
        example: 'my.rl(100, 120);',
        block: 'Right Line (rl)', parts: ['sensors', 'motors'],
        sim: 'The simulator detects the branch on sensor 8.',
    },
    {
        name: 'll', signature: 'void ll(int power, int step)', category: 'junction',
        summary: 'Follow the line, take the next LEFT branch.',
        params: [POWER, STEP],
        details: ['Mirror of rl(): branch on the left side, then tleft(). Version 4.4 uses sensor 1 alone.'],
        example: 'my.ll(100, 120);',
        block: 'Left Line (ll)', parts: ['sensors', 'motors'],
        sim: 'The simulator detects the branch on sensor 1.',
    },
    {
        name: 'prl', signature: 'void prl(int power, int step)', category: 'junction',
        summary: 'Follow the line PAST the next right branch, keep going straight.',
        params: [POWER, STEP],
        details: [
            'Stops following when the right branch is detected (version 4.4: sensor 8; version 4.2: centre sensor 4 or 5 together with sensor 7), then drives forward for step ms to clear the junction. No turn.',
            'Use it to count branches: three prl() calls pass three right branches.',
        ],
        example: 'my.prl(100, 80);\nmy.prl(100, 80);\nmy.rl(100, 120);  // third right branch',
        block: 'Past Right Line (prl)', parts: ['sensors'],
    },
    {
        name: 'pll', signature: 'void pll(int power, int step)', category: 'junction',
        summary: 'Follow the line PAST the next left branch, keep going straight.',
        params: [POWER, STEP],
        details: ['Mirror of prl(): version 4.4 uses sensor 1, version 4.2 a centre sensor + sensor 2.'],
        example: 'my.pll(100, 80);',
        block: 'Past Left Line (pll)', parts: ['sensors'],
    },
    {
        name: 'trigger', signature: 'void trigger(int power, int sensor, int step)', category: 'junction',
        summary: 'Follow the line until the chosen sensors see the line, then drive forward step ms.',
        params: [POWER, SENSOR, STEP],
        details: [
            'The most flexible junction detector. Both sensors in the number must see the line at the same time.',
            'For a single sensor repeat it: 11 = sensor 1, 88 = sensor 8. 18 = both outer sensors, i.e. a full crossing.',
        ],
        example: 'my.trigger(100, 18, 100);  // stop past a T or + crossing',
        block: 'Trigger', parts: ['sensors'],
        sim: 'The simulator also accepts one digit (e.g. 7), and fires when EITHER sensor sees the line.',
    },
    {
        name: 'rls', signature: 'void rls(int power, int sensor, int step)', category: 'junction',
        summary: 'trigger() on your chosen sensors, then turn right with tright().',
        params: [POWER, SENSOR, STEP],
        details: ['Like rl(), but you decide which sensors mark the junction.'],
        example: 'my.rls(100, 78, 120);',
        block: 'Right Line Sensor (rls)', parts: ['sensors', 'motors'],
    },
    {
        name: 'lls', signature: 'void lls(int power, int sensor, int step)', category: 'junction',
        summary: 'trigger() on your chosen sensors, then turn left with tleft().',
        params: [POWER, SENSOR, STEP],
        details: ['Like ll(), but you decide which sensors mark the junction.'],
        example: 'my.lls(100, 12, 120);',
        block: 'Left Line Sensor (lls)', parts: ['sensors', 'motors'],
    },
    {
        name: 'rld', signature: 'void rld(int power, int sensor, int step, int dly)', category: 'junction',
        summary: 'trigger(), then spin right for a fixed time instead of searching for the line.',
        params: [POWER, SENSOR, STEP, { name: 'dly', type: 'int', range: 'ms', desc: 'How long to spin right.' }],
        details: [
            'The turn is timed (motor(power, −power, dly)), not sensor-based. Use it where tright() would catch the wrong line, e.g. on diagonal branches.',
        ],
        example: 'my.rld(100, 88, 100, 180);',
        block: 'Right Line Delay (rld)', parts: ['sensors', 'motors'],
    },
    {
        name: 'lld', signature: 'void lld(int power, int sensor, int step, int dly)', category: 'junction',
        summary: 'trigger(), then spin left for a fixed time.',
        params: [POWER, SENSOR, STEP, { name: 'dly', type: 'int', range: 'ms', desc: 'How long to spin left.' }],
        details: ['Mirror of rld(): motor(−power, power, dly).'],
        example: 'my.lld(100, 11, 100, 180);',
        block: 'Left Line Delay (lld)', parts: ['sensors', 'motors'],
    },
    {
        name: 'sac', signature: 'void sac(int power)', category: 'junction',
        summary: 'Follow the line until it ends (no sensor sees it), then stop.',
        params: [POWER],
        details: ['Stop at All Colours: for the end of a track, or a gap before a finish zone.'],
        example: 'my.sac(100);',
        block: 'Stop at all Colors (sac)', parts: ['sensors'],
    },

    // ---------------- Utility
    {
        name: 'blink', signature: 'void blink()', category: 'utility',
        summary: 'Flashes the pin-13 LED once.',
        params: [],
        details: ['Handy as a marker: put blink() between steps to see on the real robot which step is running.'],
        example: 'my.blink();',
        block: 'Blink LED', parts: ['nano'],
    },
    {
        name: 'delay', signature: 'void delay(unsigned long ms)', category: 'utility',
        summary: 'Arduino built-in: waits ms milliseconds.',
        params: [{ name: 'ms', type: 'unsigned long', range: 'ms', desc: 'Time to wait.' }],
        details: ['The motors keep whatever speed they had, so after motor() (which stops) the robot stands still.'],
        example: 'delay(500);',
        block: 'Delay (ms)', parts: ['nano'],
    },
    {
        name: 'senTest', signature: 'void senTest()', category: 'utility',
        summary: 'Low-level: reads all 8 sensors through the multiplexer.',
        params: [],
        details: [
            'For i = 0…7 it writes the 3 select bits, reads A0, and stores both the raw value and the 0/1 result (compared with the sensorSet threshold).',
            'Called by every line-following and turning function.',
        ],
        example: 'my.senTest();',
        parts: ['sensors', 'mux'],
    },
    {
        name: 'battTest', signature: 'void battTest()', category: 'utility',
        summary: 'Draws the battery icon and percentage on the OLED.',
        params: [],
        details: ['Reads A7 (battery through a voltage divider) and maps it to 0–100 %. start() calls it on every menu screen (version 4.2).'],
        example: 'my.battTest();',
        parts: ['battery', 'oled'],
    },

    // ---------------- Gripper
    {
        name: 'pickup', signature: 'void pickup(int gripPower, int liftHigh, int speed, int dly)', category: 'gripper',
        summary: 'Lowers the arm, closes the gripper, lifts it again.',
        params: [
            { name: 'gripPower', type: 'int', range: '0–100', desc: 'How far to close the gripper (100 = fully closed).' },
            { name: 'liftHigh', type: 'int', range: '0–100', desc: 'How high to lift afterwards (100 = fully up).' },
            { name: 'speed', type: 'int', range: 'ms per degree', desc: 'Servo step delay. Bigger = slower, smoother.' },
            { name: 'dly', type: 'int', range: 'ms', desc: 'Pause between the three moves.' },
        ],
        details: ['Needs the optional gripper: lift servo on pin 7, grip servo on pin 8.', 'Called pu() in version 4.4 (same parameters).'],
        example: 'my.pickup(100, 100, 3, 300);',
        block: 'Pickup Arm', parts: ['nano'],
        sim: 'The simulator has no gripper. The block only waits.',
    },
    {
        name: 'putdown', signature: 'void putdown(int speed, int dly)', category: 'gripper',
        summary: 'Lowers the arm, opens the gripper, lifts it back up.',
        params: [
            { name: 'speed', type: 'int', range: 'ms per degree', desc: 'Servo step delay.' },
            { name: 'dly', type: 'int', range: 'ms', desc: 'Pause between moves.' },
        ],
        details: ['Releases whatever pickup() is holding.', 'Called pd() in version 4.4 (same parameters).'],
        example: 'my.putdown(3, 300);',
        block: 'Putdown Arm', parts: ['nano'],
        sim: 'The simulator has no gripper. The block only waits.',
    },
];

export const LIBRARY_BY_NAME: Record<string, LibFunction> = Object.fromEntries(LIBRARY.map(f => [f.name, f]));
