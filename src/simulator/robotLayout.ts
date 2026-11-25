// Physical layout of the line follower robot, shared by the 2D canvas drawing,
// the 3D model and the Learn panel diagram so all three show the same robot.
// Modelled on the mrbMaze42 robot (18.5 x 18.5 cm): a winged sensor bar at
// the front, a long neck, and a body with the two gear motors on the rear
// corners, the battery + OLED stacked between them, and the wheels outside.
//
// Units are centimetres in the robot's local frame:
//   f = forward (+ toward the sensor bar), s = sideways (+ toward the RIGHT wheel).
// The origin is the midpoint of the wheel axle (at the rear), which is also the
// point the robot pivots around when the wheels spin in opposite directions.
// Sensor positions come from Robot.getSensorLocalPosition (they drive physics).

export type PartId =
    | 'chassis'
    | 'battery'
    | 'switch'
    | 'nano'
    | 'driver'
    | 'motors'
    | 'wheels'
    | 'caster'
    | 'sensors'
    | 'mux'
    | 'oled'
    | 'buttons';

export interface Rect { f0: number; f1: number; s0: number; s1: number; }
export type Pt = [number, number]; // [f, s]

export const LAYOUT = {
    // Main body (control board): wide at the rear for the motors, narrowing
    // toward the neck
    board: [
        [-2.3, -6.6], [1.9, -6.6], [2.3, -4.6], [3.9, -4.6], [5.0, -2.2],
        [5.0, 2.2], [3.9, 4.6], [2.3, 4.6], [1.9, 6.6], [-2.3, 6.6],
    ] as Pt[],
    // Neck joining the body to the sensor bar
    neck: { f0: 4.6, f1: 13.6, s0: -1.3, s1: 1.3 } as Rect,
    boardHeader: { f0: 4.3, f1: 4.9, s0: -0.75, s1: 0.75 } as Rect,
    nano: { f0: 2.0, f1: 3.8, s0: -2.15, s1: 2.15 } as Rect,
    // Battery at the rear between the motors, OLED stacked on top of it; the
    // OLED header pins reach down to the PCB just in front of the battery
    battery: { f0: -1.35, f1: 1.35, s0: -2.6, s1: 2.6 } as Rect,
    oled: { f0: -1.05, f1: 1.75, s0: -1.35, s1: 1.35 } as Rect,
    oledScreen: { f0: -0.8, f1: 0.3, s0: -1.1, s1: 1.1 } as Rect, // 128x64 = 2:1
    oledPins: { f0: 1.4, f1: 1.65, s0: -0.9, s1: 0.9 } as Rect,
    driver: { f0: -2.15, f1: -1.5, s0: 1.6, s1: 2.6 } as Rect,
    // Six buttons in two columns. Left: POWER switch, UP, DOWN.
    // Right: MOTOR switch, OK, BACK. POWER/MOTOR are latching push switches,
    // the other four are tactile push buttons.
    switches: [{ f: 3.6, s: -3.5, label: 'POWER' }, { f: 3.6, s: 3.5, label: 'MOTOR' }],
    buttons: [
        { f: 2.55, s: -3.5, label: 'UP' }, { f: 1.65, s: -3.5, label: 'DOWN' },
        { f: 2.55, s: 3.5, label: 'OK' }, { f: 1.65, s: 3.5, label: 'BACK' },
    ],
    screws: [[-1.85, -6.0], [-1.85, 6.0], [4.45, -1.5], [4.45, 1.5]] as Pt[],
    // Gear motors on the rear corners: can toward the middle, gearbox outside
    motorL: { f0: -1.15, f1: 1.15, s0: -7.15, s1: -2.9 } as Rect,
    motorR: { f0: -1.15, f1: 1.15, s0: 2.9, s1: 7.15 } as Rect,
    gearboxLen: 1.7,
    wheel: { radius: 1.9, width: 2.0, s: 8.25 }, // s = centre offset of each wheel
};

// Overall bounding box (handy for fitting the diagram)
export const LAYOUT_BOUNDS = { f0: -2.6, f1: 15.8, s0: -9.6, s1: 9.6 };

export interface SensorBoardShape {
    bar: Pt[]; // centre line of the bar, stroked with BAR_WIDTH
    wings: Pt[][]; // left and right swept-back wing polygons
    stem: Rect; // the neck
    holes: Pt[]; // skid / mounting holes in the wings
    header: Rect; // ribbon-cable header
    mux: Rect; // multiplexer chip behind the sensors
}

export const BAR_WIDTH = 2.1;

// The sensor bar follows the M-shaped sensor line and ends in wings that
// sweep back to a point, like an anchor.
export function sensorBoardShape(sensors: { f: number; s: number }[]): SensorBoardShape {
    const bar: Pt[] = sensors.map(p => [p.f - 0.1, p.s]);
    const wing = (side: -1 | 1): Pt[] => {
        const e = side === 1 ? sensors[sensors.length - 1] : sensors[0];
        const o = (df: number, ds: number): Pt => [e.f + df, e.s + side * ds];
        return [o(0.85, -0.2), o(0.6, 1.1), o(-2.7, 2.5), o(-3.2, 1.8), o(-1.1, -0.3)];
    };
    const end = sensors[0];
    const centreF = Math.min(...sensors.slice(3, 5).map(p => p.f));
    return {
        bar,
        wings: [wing(-1), wing(1)],
        stem: { ...LAYOUT.neck, f1: centreF - 0.4 },
        holes: [[end.f - 1.9, -(Math.abs(end.s) + 1.55)], [end.f - 1.9, Math.abs(end.s) + 1.55]],
        header: { f0: centreF - 2.6, f1: centreF - 2.0, s0: -0.65, s1: 0.65 },
        mux: { f0: centreF - 1.3, f1: centreF - 0.75, s0: -0.5, s1: 0.5 },
    };
}

export const PART_ORDER: PartId[] = [
    'sensors', 'mux', 'nano', 'driver', 'motors', 'wheels', 'battery', 'oled', 'buttons', 'switch', 'caster', 'chassis',
];

export const PART_COLORS = {
    board: '#1b7fb8', // body
    boardEdge: '#14628f',
    neck: '#2aa7e0',
    sensorPcb: '#1b7fb8',
    ribbon: '#cbd5e1',
    tire: '#1f2937', // dark tyres
    hub: '#9ca3af',
    motorCan: '#e5e7eb',
    gearbox: '#9ca3af',
    nano: '#1d4ed8',
    chip: '#111827',
    driver: '#111827',
    batt: '#facc15', // yellow battery pack
    battEdge: '#ca8a04',
    oled: '#0f172a',
    oledScreen: '#0c4a6e',
    button: '#e5e7eb',
    switch: '#f8fafc',
    usb: '#d1d5db',
    emitter: '#ef4444', // red LED emitters
    highlight: '#f97316',
};
