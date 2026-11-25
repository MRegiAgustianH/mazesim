import type { PartId } from '../simulator/robotLayout';

// Hardware reference for every part drawn on the robot. Specs follow the
// mrbMaze42 robot spec sheet; pin numbers come from mrbMaze42.cpp.

export interface PinInfo { pin: string; signal: string; }

export interface HardwarePart {
    id: PartId;
    name: string;
    role: string; // one-line job description
    description: string[];
    specs: [string, string][];
    pins?: PinInfo[];
    functions: string[]; // library functions that use this part
    tip?: string;
}

export const HARDWARE_PARTS: Record<PartId, HardwarePart> = {
    sensors: {
        id: 'sensors',
        name: '8-channel line sensor',
        role: 'The eyes: tell the robot where the line is.',
        description: [
            'The winged board at the front carries 8 sensor channels in a row. Each channel has a red LED that shines on the floor and a photodiode next to it that measures how much light comes back.',
            'A white floor reflects a lot of light, a black line absorbs most of it. The photodiode turns that difference into a voltage, and the Arduino reads it as a number from 0 to 1023.',
            'The library compares each reading with a threshold set by sensorSet(). Each sensor becomes a 0 or 1, so the whole array is an 8-bit pattern such as 00011000 (line in the centre).',
            'A flat ribbon cable along the neck connects it to the control board. It sits only a few millimetres above the floor, so outside light has little effect.',
        ],
        specs: [
            ['Channels', '8 (numbered 1–8, left to right)'],
            ['Per channel', 'Red LED emitter + photodiode'],
            ['Reading', '10-bit analog, 0–1023, through the multiplexer'],
            ['Connection', 'Ribbon cable to the control board'],
        ],
        pins: [
            { pin: 'D6', signal: 'Sensor LEDs on/off (turned on by start(), off by end())' },
            { pin: 'A0', signal: 'Shared analog output of all 8 channels (via the multiplexer)' },
        ],
        functions: ['sensorSet', 'lineColour', 'senTest', 'lineTrace', 'trigger'],
        tip: 'In the simulator the dot on each sensor turns red when it sees the line. Watch them while the robot follows a curve.',
    },
    mux: {
        id: 'mux',
        name: 'Analog multiplexer',
        role: 'Lets 8 sensors share one analog pin.',
        description: [
            'The black chip in the middle of the sensor board is an 8-channel analog multiplexer (74HC4051-type): an electronic switch with three select lines that connects one of the 8 photodiodes to its single output.',
            'senTest() loops i = 0…7, writes the three bits of i to S0, S1 and S2, and then reads A0. Eight quick reads give the full sensor picture in under a millisecond.',
            'This is why a thin ribbon cable is enough: power, the 3 select lines, the LED switch and one analog signal.',
        ],
        specs: [
            ['Channels', '8 in → 1 out'],
            ['Select lines', '3 (2³ = 8 channels)'],
        ],
        pins: [
            { pin: 'A1 (D15)', signal: 'S0 select bit' },
            { pin: 'A2 (D16)', signal: 'S1 select bit' },
            { pin: 'A3 (D17)', signal: 'S2 select bit' },
            { pin: 'A0', signal: 'Common output → Arduino ADC' },
        ],
        functions: ['senTest'],
    },
    nano: {
        id: 'nano',
        name: 'Arduino Nano',
        role: 'The brain: runs your program.',
        description: [
            'A small board built around the ATmega328P microcontroller, plugged into headers in the middle of the control board. Your Blockly program becomes an Arduino sketch (.ino) that calls the mrbMaze library, and you upload it through the USB port.',
            'In a loop it reads the sensors, works out how far the robot is from the line, and sets the speed of each motor. A lineTrace() step takes about 1–2 ms, so it corrects the steering hundreds of times per second.',
            'The LED on pin 13 lights while motor() and some other functions run, which helps when you debug on the real robot.',
        ],
        specs: [
            ['Microcontroller', 'ATmega328P, 16 MHz, 5 V logic'],
            ['Memory', '32 KB flash, 2 KB SRAM, 1 KB EEPROM'],
            ['I/O', '14 digital (6 PWM), 8 analog inputs'],
            ['Power in', 'USB 5 V or VIN from the battery'],
        ],
        pins: [
            { pin: 'D2 / D3', signal: 'Left motor direction / PWM' },
            { pin: 'D4 / D5', signal: 'Right motor direction / PWM' },
            { pin: 'D6', signal: 'Sensor LEDs' },
            { pin: 'D7 / D8', signal: 'Lift / grip servo (optional gripper)' },
            { pin: 'D9–D12', signal: 'Buttons DOWN, UP, OK, BACK' },
            { pin: 'D13', signal: 'Status LED' },
            { pin: 'A0–A3', signal: 'Sensor multiplexer' },
            { pin: 'A4 / A5', signal: 'I²C SDA / SCL to the OLED' },
            { pin: 'A7', signal: 'Battery voltage sense' },
        ],
        functions: ['mazeSetup', 'start', 'end', 'blink'],
    },
    driver: {
        id: 'driver',
        name: 'Motor driver',
        role: 'The muscle amplifier between the Nano and the motors.',
        description: [
            'An Arduino pin can only supply a few milliamps. The motors need far more. The driver on the control board is a dual H-bridge: it switches battery current through each motor in either direction, controlled by small logic signals from the Nano.',
            'Each motor has two control pins: DIR picks forward or backward, PWM sets the speed. PWM switches the power on and off very fast; the fraction of time it is on (the duty cycle) sets the average voltage and so the speed.',
            'You never drive these pins yourself. motor() and motorDrive() take a speed from −255 to 255, set DIR from the sign, and write the PWM value. This board expects the PWM value inverted (255 − speed), and the library handles that.',
        ],
        specs: [
            ['Channels', '2 (left and right motor)'],
            ['Control', 'DIR + PWM per motor'],
            ['Speed range', '−255 (full reverse) … 0 (stop) … 255 (full forward)'],
        ],
        pins: [
            { pin: 'D2', signal: 'Left DIR' }, { pin: 'D3', signal: 'Left PWM' },
            { pin: 'D4', signal: 'Right DIR' }, { pin: 'D5', signal: 'Right PWM' },
        ],
        functions: ['motorDrive', 'motor'],
    },
    motors: {
        id: 'motors',
        name: '2× DC gear motors',
        role: 'Turn electricity into wheel rotation.',
        description: [
            'Two brushed DC motors with metal gearboxes sit on the rear corners of the body, on one axle line, each driving the wheel next to it. The motor spins very fast; the gearbox trades some of that speed for torque so the wheel turns with more force.',
            'With the gearbox the output shaft turns at about 1200 RPM. That is roughly 1.2 m/s at power 100 and 2–3 m/s at full power, which is why maze programs usually run at power 80–150, not 255.',
            'More voltage means more speed. The driver changes the average voltage with PWM, so motor(100, 100, 0) drives at roughly 40 % of full power.',
            'No two motors are identical. The same PWM value can make one wheel a little faster than the other, so a robot driving "straight" with motor() slowly drifts. Line tracing with feedback fixes that automatically.',
        ],
        specs: [
            ['Type', 'Brushed DC with metal gearbox'],
            ['Speed', '≈ 1200 RPM after the gearbox'],
            ['Mounting', 'Rear corners of the body, on one axle line'],
        ],
        functions: ['motor', 'motorDrive', 'tright', 'tleft'],
    },
    wheels: {
        id: 'wheels',
        name: 'Wheels (differential drive)',
        role: 'Move and steer the robot.',
        description: [
            'One rubber wheel sits at each end of the motor axle, at the back of the robot. The robot has no steering wheel: it steers by driving the left and right wheels at different speeds. This is called differential drive.',
            'Both wheels equal → straight. Left faster than right → curves to the right. Left forward and right backward → spins on the spot around the middle of the axle. Because the axle is at the back, the sensor bar 14.5 cm ahead swings through a wide arc while the robot turns.',
            'The wide track (wheels about 16.5 cm apart) makes the robot stable at speed. Dust on the tyres makes it slide in fast turns, so clean them before a run.',
        ],
        specs: [
            ['Tyres', 'Rubber, ≈ 3.8 cm diameter'],
            ['Track width', '≈ 16.5 cm between tyre centres'],
            ['Turning centre', 'Middle of the wheel axle, 14.5 cm behind the sensors'],
        ],
        functions: ['motor', 'tright', 'tleft'],
        tip: 'Try motor(150, 150, 1000), then motor(150, 50, 1000), then motor(100, -100, 500) and watch the path in the simulator.',
    },
    caster: {
        id: 'caster',
        name: 'Front skids',
        role: 'Hold up the front of the robot.',
        description: [
            'There is no third wheel. The front of the robot rests on the sensor board: low skids under its wing tips slide over the floor.',
            'The skids also fix how high the sensors sit above the floor. Keep them clean and smooth: a skid that catches on a track joint makes the robot twitch.',
        ],
        specs: [['Position', 'Under the wing tips of the sensor board']],
        functions: [],
    },
    battery: {
        id: 'battery',
        name: 'LiPo battery (3S 500 mAh)',
        role: 'Power for everything.',
        description: [
            'A 3-cell lithium-polymer pack at the back of the body, between the two motors, with the OLED stacked on top of it. Three cells in series give about 11.1 V (12.6 V full). It feeds the motor driver directly and the Nano through its VIN input.',
            'The Nano measures the pack voltage through a voltage divider on A7. battTest() turns that reading into the percentage shown in the corner of the OLED menu.',
            'Speed depends on voltage: the same program runs faster with a full battery. Tune your power values with a charged pack, and recheck when it gets low.',
        ],
        specs: [
            ['Type', 'LiPo, 3 cells in series (3S)'],
            ['Voltage', '11.1 V nominal, 12.6 V full'],
            ['Capacity', '500 mAh'],
        ],
        pins: [{ pin: 'A7', signal: 'Battery voltage through a divider' }],
        functions: ['battTest'],
        tip: 'Charge LiPo packs only with a balance charger, never let a cell drop below about 3.0 V, and stop using a pack that is puffy or damaged.',
    },
    switch: {
        id: 'switch',
        name: 'POWER & MOTOR switches',
        role: 'Turn the robot and the motors on or off.',
        description: [
            'Two latching push switches at the top of the button columns: POWER on the left, MOTOR on the right. Press once to latch ON, press again for OFF. POWER connects the battery to the whole robot. MOTOR cuts power to the motors only, so you can browse the menu and test the sensors while the robot stays still.',
            'Switch the motors off when you plug in USB to upload code or carry the robot, so it can’t drive off the table. Try both in the Robot panel of the simulator.',
        ],
        specs: [['Count', '2 (POWER, MOTOR)'], ['Type', 'Latching push switch']],
        functions: [],
    },
    oled: {
        id: 'oled',
        name: 'OLED display 0.96"',
        role: 'Shows the menu, battery and sensor values.',
        description: [
            'A 0.96-inch 128×64-pixel OLED stacked on top of the battery, at the back between the motors. Its 4 header pins (GND, VCC, SCL, SDA) reach down to the PCB in front of the battery. It talks to the Nano over I²C, a two-wire bus (data + clock).',
            'welcomeScreen() shows the logo. start() draws the menu: Go, Speed test, Sensor calibrate and Gripper. Version 4.2 shows the battery percentage in the top corner, version 4.4 shows "V4.4".',
            'Open the Robot panel in the simulator to see the same screens, drawn from the library’s own bitmaps, and drive the menu with the six buttons.',
        ],
        specs: [
            ['Controller', 'SSD1306'],
            ['Resolution', '128 × 64'],
            ['Bus', 'I²C, address 0x3C'],
        ],
        pins: [{ pin: 'A4', signal: 'SDA (data)' }, { pin: 'A5', signal: 'SCL (clock)' }],
        functions: ['welcomeScreen', 'start', 'battTest'],
    },
    buttons: {
        id: 'buttons',
        name: 'Push buttons',
        role: 'Navigate the menu and start the run.',
        description: [
            'Four tactile push buttons: UP and DOWN under the POWER switch on the left, OK and BACK under the MOTOR switch on the right. They use the Nano’s internal pull-up resistors, so a pin reads HIGH normally and LOW while you press it.',
            'start() waits here: UP/DOWN move through the menu, OK picks an item. Choosing "Go" turns on the sensor LEDs and returns, and the code in loop() starts running.',
        ],
        specs: [['Count', '4 tactile (plus the 2 switches = 6 buttons)'], ['Wiring', 'To GND, INPUT_PULLUP (pressed = LOW)']],
        pins: [
            { pin: 'D9', signal: 'DOWN' }, { pin: 'D10', signal: 'UP' },
            { pin: 'D11', signal: 'OK' }, { pin: 'D12', signal: 'BACK' },
        ],
        functions: ['start'],
    },
    chassis: {
        id: 'chassis',
        name: 'Frame & control board',
        role: 'Holds every part and carries the wiring.',
        description: [
            'The robot has no separate chassis plate. The body is the control board: it carries the motors, battery, Nano, OLED, buttons, switches and motor driver, and its copper tracks connect them.',
            'A long neck carries the sensor bar 14.5 cm ahead of the wheel axle, with a ribbon cable running along it. The further the sensors are ahead of the wheels, the earlier the robot sees a curve, but the harder it is to keep stable at high speed.',
        ],
        specs: [['Size', '18.5 × 18.5 × 5 cm'], ['Weight', '≈ 450 g with battery']],
        functions: [],
    },
};

export interface Lesson {
    id: string;
    title: string;
    parts: PartId[]; // highlighted on the robot while the lesson is open
    body: string[];
    functions: string[];
    tryIt?: string;
}

// A learning path from "what is a line follower" to junction programs,
// following the course order: setup program, basic program, junction program.
export const LESSONS: Lesson[] = [
    {
        id: 'overview',
        title: 'How a line follower works',
        parts: ['sensors', 'nano', 'motors'],
        body: [
            'A line follower repeats three steps very quickly: sense, decide, act.',
            'Sense: the 8 sensors at the front report which of them sit over the line. Decide: the Arduino turns that into an error, meaning how far left or right the line is. Act: the motor driver slows one wheel and keeps the other fast, steering back onto the line.',
            'The rest of this path walks through each part in that loop, then the three kinds of program you write: setup, basic moves, and junctions.',
        ],
        functions: [],
        tryIt: 'Press Simulate with the default program and watch the sensor dots turn red as the robot moves.',
    },
    {
        id: 'power',
        title: 'Power: LiPo battery and switches',
        parts: ['battery', 'switch'],
        body: [
            'Everything starts with the 3-cell LiPo (≈ 11.1 V). The motors take most of the current. The Nano and sensors need very little.',
            'A low battery makes the robot slower and changes how it handles turns, so check the percentage on the OLED before every run.',
        ],
        functions: ['battTest'],
    },
    {
        id: 'brain',
        title: 'Program setup: the Arduino Nano',
        parts: ['nano', 'chassis'],
        body: [
            'Every program has the same shape. setup() runs once: it prepares the pins (mazeSetup), shows the logo, sets the sensor thresholds and PID gains, and waits for the start button.',
            'loop() holds your route: the blocks you stack in Blockly become lines like my.rl(100, 100); here. At the end my.end() switches the sensors off and resets the board.',
        ],
        functions: ['mazeSetup', 'welcomeScreen', 'sensorSet', 'pidSet', 'lineColour', 'start', 'end'],
        tryIt: 'Click "Download .ino" and open the file: find setup(), loop() and your blocks.',
    },
    {
        id: 'eyes',
        title: 'The eyes: 8-channel line sensor',
        parts: ['sensors', 'mux'],
        body: [
            'Each sensor gives a number. sensorSet() stores one threshold per sensor, and every reading is turned into "line" or "no line". Real floors and lighting differ, which is why the real robot has a calibration menu.',
            'lineColour(0) means a dark line on a light floor, lineColour(1) means a light line on a dark floor.',
            'All 8 results together form a pattern. 00011000 means centred, 11000000 means the line is far to the left, 11111111 usually means a crossing.',
        ],
        functions: ['sensorSet', 'lineColour', 'senTest'],
        tryIt: 'Drag the robot (2D view) slowly across a line and watch which sensors switch on.',
    },
    {
        id: 'muscles',
        title: 'Basic program: motors and driver',
        parts: ['motors', 'driver'],
        body: [
            'motor(left, right, time) is the most basic command: it sets both wheel speeds (−255…255), waits for time milliseconds and stops.',
            'Negative values reverse a wheel. On the real robot motor() always stops the wheels when the time is up. In the simulator a time of 0 leaves the motors running, so the next block takes over without a stop.',
        ],
        functions: ['motor', 'motorDrive'],
        tryIt: 'Build: motor(150, 150, 800) then motor(-150, -150, 800). The robot should come back to where it started.',
    },
    {
        id: 'steering',
        title: 'Steering with two wheels',
        parts: ['wheels', 'caster'],
        body: [
            'Differential drive: speed difference = turning. A big difference gives a tight turn, opposite directions spin on the spot.',
            'tright() and tleft() use this: they spin in place until the sensors find the line again, so the robot ends a turn lined up with the new line.',
        ],
        functions: ['tright', 'tleft'],
    },
    {
        id: 'pid',
        title: 'Following the line with PID',
        parts: ['sensors', 'nano', 'motors'],
        body: [
            'lineTrace() reads the sensors and looks the pattern up in a table: centre = 0, the line to the left gives +1 … +7, to the right −1 … −7.',
            'It then computes a correction: P (proportional) reacts to the error now, I uses the sum of the last two errors, D reacts to how fast the error changes. pidSet(28, 8, 8) sets those gains.',
            'The correction slows down one wheel: left = power − correction, right = power + correction, and neither wheel goes faster than power.',
            'Too little Kp and the robot drifts off in curves. Too much and it wobbles. Kd damps the wobble.',
        ],
        functions: ['pidSet', 'lineTrace', 'lineTraceSmooth', 'ld'],
        tryIt: 'Use a Line Delay (ld) block at power 80, then at 200. Notice how the higher speed needs the corrections more.',
    },
    {
        id: 'junctions',
        title: 'Junction program: turns and branches',
        parts: ['sensors'],
        body: [
            'Maze and competition tracks are made of junctions. The junction functions all work the same way: follow the line until a sensor pattern appears, drive forward a little (step, in ms) so the wheels reach the crossing, then turn or carry on.', 'The sensors are 14.5 cm ahead of the wheels, so step has to carry the robot about that far. At power 100, step 100 already turns smoothly and step 120 puts the axle right on the crossing for a clean turn. Step too long and the turn catches the next line.',
            'rl / ll: take the next right / left branch. prl / pll: pass a right / left branch and keep going. trigger, rls, lls, rld, lld: you choose the sensor that marks the junction. sac: follow until the line ends.',
        ],
        functions: ['rl', 'll', 'prl', 'pll', 'trigger', 'rls', 'lls', 'rld', 'lld', 'sac'],
        tryIt: 'Pick Track: Maze Grid and run rl(100, 120). Then try step 200 and watch the turn overshoot to the next line.',
    },
    {
        id: 'interface',
        title: 'Menu, display and buttons',
        parts: ['oled', 'buttons'],
        body: [
            'On the real robot nothing moves until you press OK on "Go" in the start() menu. That gives you time to put the robot on the start cross.',
            'The other menu items test the motor speed, calibrate the sensors and test the gripper.',
        ],
        functions: ['start', 'welcomeScreen', 'blink'],
    },
];
