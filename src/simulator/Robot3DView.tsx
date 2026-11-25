import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useStore } from '../store/useStore';
import type { Robot } from './Robot';
import { robotUi } from '../oled/robotUi';
import { useT } from '../i18n/i18n';
import { BAR_WIDTH, LAYOUT, PART_COLORS as C, sensorBoardShape, type PartId, type Pt, type Rect } from './robotLayout';

// 3D view of the simulator. Physics and sensors still run on the 2D canvas
// (CanvasRenderer); this view only mirrors the robot pose every frame.
//
// World units are centimetres. Canvas px (x, y) -> world (x, z):
//   wx = x / ppc - W/2,  wz = y / ppc - H/2   (W, H = track size in cm)
// A canvas heading `angle` maps to rotation.y = -angle (model faces +X).

type CameraMode = 'chase' | 'free' | 'top';

interface Props {
    getRobot: () => Robot | null;
    getTrackCanvas: () => HTMLCanvasElement | null;
    setRobotPose: (x: number, y: number, angle: number) => void;
}

const COLORS = {
    ledOff: 0x1f2937,
    ledOn: 0xef4444,
    highlight: 0xf97316,
};

type Mat = THREE.MeshStandardMaterial;

// Builds the robot from the shared LAYOUT (cm). Model faces +X; local f -> x,
// s -> z (+z = right wheel), y = up. Every mesh is tagged with its PartId so
// the Learn tab can make the selected part glow.
function buildRobotModel(robot: Robot) {
    const ppc = robot.pixelsPerCm;
    const L = LAYOUT;
    const group = new THREE.Group();
    const parts = new Map<PartId, THREE.Mesh[]>();
    const hex = (c: string) => new THREE.Color(c).getHex();
    const mat = (color: number | string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
        new THREE.MeshStandardMaterial({ color: typeof color === 'string' ? hex(color) : color, roughness: 0.6, metalness: 0.1, ...extra });

    const add = (part: PartId, geo: THREE.BufferGeometry, m: Mat, x: number, y: number, z: number, parent: THREE.Object3D = group) => {
        const mesh = new THREE.Mesh(geo, m);
        mesh.position.set(x, y, z);
        mesh.userData.part = part;
        mesh.castShadow = true;
        parent.add(mesh);
        if (!parts.has(part)) parts.set(part, []);
        parts.get(part)!.push(mesh);
        return mesh;
    };
    // Box from a layout rect, sitting on top of height `y0`
    const box = (part: PartId, r: Rect, y0: number, h: number, m: Mat) =>
        add(part, new THREE.BoxGeometry(r.f1 - r.f0, h, r.s1 - r.s0), m, (r.f0 + r.f1) / 2, y0 + h / 2, (r.s0 + r.s1) / 2);
    // Flat plate from an (f, s) polygon, top surface at `top`
    const plate = (part: PartId, pts: Pt[], top: number, t: number, m: Mat) => {
        const shape = new THREE.Shape(pts.map(([f, s]) => new THREE.Vector2(f, s)));
        const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
        geo.rotateX(Math.PI / 2); // shape (x, y) -> (x, z), extruded downward
        return add(part, geo, m, 0, top, 0);
    };
    const sqr = (f: number, s: number, h: number): Rect => ({ f0: f - h, f1: f + h, s0: s - h, s1: s + h });

    const T = 0.16; // PCB thickness
    const R = L.wheel.radius;
    const baseY = 0.85; // underside of the body, neck and sensor bar
    const top = baseY + T;
    const battH = 1.6; // battery height (the OLED sits on top of it)

    // ---- Body (control board)
    const body = plate('chassis', L.board, top, T, mat(C.board, { roughness: 0.45 }));
    body.receiveShadow = true;
    for (const [f, s] of L.screws) add('chassis', new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12), mat('#cbd5e1', { metalness: 0.7 }), f, top + 0.06, s);
    box('chassis', L.boardHeader, top, 0.55, mat('#111827'));

    // ---- Gear motors on the rear corners, wheels outside them
    const canMat = mat(C.motorCan, { metalness: 0.75, roughness: 0.3 });
    const gearMat = mat(C.gearbox, { metalness: 0.7, roughness: 0.45 });
    for (const [r, side] of [[L.motorL, -1], [L.motorR, 1]] as const) {
        const g = L.gearboxLen;
        const canLen = r.s1 - r.s0 - g;
        const canZ = side === 1 ? r.s0 + canLen / 2 : r.s1 - canLen / 2;
        const can = add('motors', new THREE.CylinderGeometry(0.85, 0.85, canLen, 22), canMat, 0, R, canZ);
        can.rotation.x = Math.PI / 2;
        const gbZ = side === 1 ? r.s1 - g / 2 : r.s0 + g / 2;
        add('motors', new THREE.BoxGeometry(r.f1 - r.f0, 1.8, g), gearMat, 0, top + 0.9, gbZ);
        // Shaft to the wheel
        const shaft = add('motors', new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8), mat('#4b5563', { metalness: 0.8 }), 0, R, side === 1 ? r.s1 + 0.3 : r.s0 - 0.3);
        shaft.rotation.x = Math.PI / 2;
    }

    const wheels: THREE.Group[] = [];
    const tyreMat = mat(C.tire, { roughness: 0.95 });
    const hubMat = mat(C.hub, { roughness: 0.4, metalness: 0.5 });
    for (const side of [-1, 1]) {
        const wheel = new THREE.Group();
        wheel.position.set(0, R, side * L.wheel.s);
        group.add(wheel);
        const tyre = add('wheels', new THREE.CylinderGeometry(R, R, L.wheel.width, 32), tyreMat, 0, 0, 0, wheel);
        tyre.rotation.x = Math.PI / 2;
        const hub = add('wheels', new THREE.CylinderGeometry(R * 0.55, R * 0.55, L.wheel.width + 0.04, 20), hubMat, 0, 0, 0, wheel);
        hub.rotation.x = Math.PI / 2;
        // Spokes make the spin visible
        for (let i = 0; i < 3; i++) {
            const spoke = add('wheels', new THREE.BoxGeometry(R * 1.05, 0.22, L.wheel.width + 0.08), mat('#e5e7eb'), 0, 0, 0, wheel);
            spoke.rotation.z = (i * Math.PI) / 3;
        }
        wheels.push(wheel);
    }

    // ---- Battery pack in the middle of the body
    box('battery', L.battery, top, battH, mat(C.batt, { roughness: 0.5 }));
    box('battery', { f0: L.battery.f0 + 0.3, f1: L.battery.f0 + 0.9, s0: L.battery.s1 - 0.05, s1: L.battery.s1 + 0.35 }, top + 0.6, 0.35, mat('#dc2626'));

    // ---- Control board parts
    const switchCaps = L.switches.map(sw => {
        box('switch', sqr(sw.f, sw.s, 0.55), top, 0.55, mat('#334155'));
        return box('switch', sqr(sw.f, sw.s, 0.4), top + 0.55, 0.35, mat(C.switch));
    });

    // OLED stacked on the battery; its header pins run down to the PCB
    const oledY = top + battH + 0.12;
    box('oled', L.oledPins, top, oledY - top, mat('#111827'));
    for (let i = 0; i < 4; i++) {
        const sPin = L.oledPins.s0 + 0.25 + i * ((L.oledPins.s1 - L.oledPins.s0 - 0.5) / 3);
        box('oled', { f0: L.oledPins.f0 + 0.05, f1: L.oledPins.f0 + 0.17, s0: sPin - 0.06, s1: sPin + 0.06 }, oledY, 0.25, mat('#fbbf24', { metalness: 0.8 }));
    }
    box('oled', L.oled, oledY, 0.12, mat('#1e3a8a'));
    const oledTex = new THREE.CanvasTexture(robotUi.canvas);
    oledTex.magFilter = THREE.NearestFilter;
    oledTex.minFilter = THREE.LinearFilter;
    oledTex.colorSpace = THREE.SRGBColorSpace;
    {
        const sc = L.oledScreen;
        const geo = new THREE.PlaneGeometry(sc.s1 - sc.s0, sc.f1 - sc.f0);
        geo.rotateX(-Math.PI / 2); // lie flat, picture top toward -z
        geo.rotateY(-Math.PI / 2); // picture x -> robot right (+z), top -> front (+x)
        const screen = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: oledTex }));
        screen.position.set((sc.f0 + sc.f1) / 2, oledY + 0.13, (sc.s0 + sc.s1) / 2);
        group.add(screen);
    }

    for (const b of L.buttons) {
        box('buttons', sqr(b.f, b.s, 0.45), top, 0.35, mat('#1f2937'));
        add('buttons', new THREE.CylinderGeometry(0.27, 0.27, 0.25, 14), mat(C.button), b.f, top + 0.47, b.s);
    }

    box('driver', L.driver, top, 0.18, mat(C.driver));

    const nanoY = top + 0.85;
    box('nano', { ...L.nano, f0: L.nano.f0 - 0.05, f1: L.nano.f0 + 0.3 }, top, 0.85, mat('#111827'));
    box('nano', { ...L.nano, f0: L.nano.f1 - 0.3, f1: L.nano.f1 + 0.05 }, top, 0.85, mat('#111827'));
    box('nano', L.nano, nanoY, T, mat(C.nano, { roughness: 0.45 }));
    const mid = (L.nano.f0 + L.nano.f1) / 2;
    const chip = box('nano', { f0: mid - 0.4, f1: mid + 0.4, s0: -0.3, s1: 0.5 }, nanoY + T, 0.12, mat(C.chip));
    chip.rotation.y = Math.PI / 4;
    box('nano', { f0: L.nano.f0 + 0.55, f1: L.nano.f1 - 0.55, s0: L.nano.s1 - 0.6, s1: L.nano.s1 + 0.15 }, nanoY + T, 0.4, mat(C.usb, { metalness: 0.8, roughness: 0.3 }));
    const nanoLed = add('nano', new THREE.SphereGeometry(0.12, 10, 6), mat('#7f1d1d'), L.nano.f1 - 0.55, nanoY + 0.2, L.nano.s0 + 0.8);

    // ---- Neck + winged sensor bar, red LED emitters and photodiodes underneath,
    //      indicator LEDs on top (red = sees the line)
    const sensors = Array.from({ length: 8 }, (_, i) => {
        const p = robot.getSensorLocalPosition(i);
        return { f: p.forwardX / ppc, s: p.rightY / ppc };
    });
    const sb = sensorBoardShape(sensors);
    const sensorMat = mat(C.sensorPcb, { roughness: 0.5 });
    box('sensors', sb.stem, baseY, T, mat(C.neck, { roughness: 0.5 }));
    for (let i = 0; i < sb.bar.length - 1; i++) {
        const [af, as] = sb.bar[i], [bf, bs] = sb.bar[i + 1];
        const len = Math.hypot(bf - af, bs - as) + BAR_WIDTH * 0.5;
        const seg = add('sensors', new THREE.BoxGeometry(BAR_WIDTH, T, len), sensorMat, (af + bf) / 2, baseY + T / 2, (as + bs) / 2);
        seg.rotation.y = Math.atan2(bf - af, bs - as);
    }
    for (const w of sb.wings) plate('sensors', w, top, T, sensorMat);
    box('sensors', sb.header, top, 0.5, mat('#111827'));
    // Ribbon cable lying along the neck
    box('sensors', { f0: L.boardHeader.f1 - 0.1, f1: sb.header.f0 + 0.15, s0: -0.6, s1: 0.6 }, top + 0.02, 0.05, mat(C.ribbon));

    const emitterMat = mat(C.emitter, { emissive: hex('#dc2626'), emissiveIntensity: 0.8, roughness: 0.25, transparent: true, opacity: 0.9 });
    const diodeMat = mat('#334155', { roughness: 0.3 });
    for (const p of sensors) {
        add('sensors', new THREE.CylinderGeometry(0.28, 0.28, 0.45, 12), emitterMat, p.f + 0.45, baseY - 0.22, p.s);
        add('sensors', new THREE.CylinderGeometry(0.25, 0.25, 0.4, 12), diodeMat, p.f - 0.3, baseY - 0.2, p.s);
    }
    const leds = sensors.map(p => {
        const led = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.15, 0.24),
            new THREE.MeshStandardMaterial({ color: COLORS.ledOff, emissive: 0x000000 }),
        );
        led.position.set(p.f - 0.7, top + 0.08, p.s);
        group.add(led);
        return led;
    });
    box('mux', sb.mux, top, 0.18, mat(C.chip));

    // ---- Front skids under the wings
    for (const [f, s] of sb.holes) {
        add('caster', new THREE.CylinderGeometry(0.32, 0.4, baseY, 12), mat('#d4a017', { metalness: 0.8, roughness: 0.3 }), f, baseY / 2, s);
    }

    group.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    return { group, wheels, leds, wheelR: R, parts, nanoLed, switchCaps, capY: top + 0.55, oledTex };
}

// Makes the selected part glow (pulsing) and restores the rest.
function applyHighlight(model: ReturnType<typeof buildRobotModel>, part: PartId | null, t: number) {
    const pulse = 0.35 + 0.35 * Math.sin(t / 180);
    model.parts.forEach((meshes, id) => {
        for (const mesh of meshes) {
            const m = mesh.material as Mat;
            if (m.userData.baseEmissive === undefined) {
                m.userData.baseEmissive = m.emissive.getHex();
                m.userData.baseIntensity = m.emissiveIntensity;
            }
            if (id === part) {
                m.emissive.setHex(COLORS.highlight);
                m.emissiveIntensity = pulse;
            } else {
                m.emissive.setHex(m.userData.baseEmissive);
                m.emissiveIntensity = m.userData.baseIntensity;
            }
        }
    });
}

function makeMarker(color: number, height = 14) {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, height, 8), m);
    pole.position.y = height / 2;
    const flag = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 0.2), m);
    flag.position.set(2.5, height - 1.5, 0);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.2, 24), new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.35 }));
    base.position.y = 0.1;
    g.add(pole, flag, base);
    return g;
}

export const Robot3DView: React.FC<Props> = ({ getRobot, getTrackCanvas, setRobotPose }) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const [mode, setMode] = useState<CameraMode>('chase');
    const t = useT();
    const modeRef = useRef<CameraMode>(mode);

    useEffect(() => { modeRef.current = mode; }, [mode]);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xe2e8f0);
        scene.fog = new THREE.Fog(0xe2e8f0, 400, 900);

        const camera = new THREE.PerspectiveCamera(55, 1, 1, 3000);
        camera.position.set(0, 200, 200);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.maxPolarAngle = Math.PI / 2.05;

        scene.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.6));
        const sun = new THREE.DirectionalLight(0xffffff, 1.6);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
        sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
        sun.shadow.camera.near = 1; sun.shadow.camera.far = 300;
        scene.add(sun, sun.target);

        // Ground around the mat
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 1 }));
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.3;
        scene.add(ground);

        // Track mat: textured from the 2D track canvas
        const texture = new THREE.CanvasTexture(getTrackCanvas() ?? document.createElement('canvas'));
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const mat = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 }));
        mat.rotation.x = -Math.PI / 2;
        mat.receiveShadow = true;
        scene.add(mat);

        const markers = new THREE.Group();
        scene.add(markers);

        let model: ReturnType<typeof buildRobotModel> | null = null;
        let trackDirty = true;
        const onTrackUpdated = () => { trackDirty = true; };
        window.addEventListener('track-updated', onTrackUpdated);
        let oledRev = -1;
        let modelRobot: Robot | null = null;
        let size = { w: 0, h: 0, ppc: 0 };
        let markersKey = '';
        let raf = 0;
        let lastT = performance.now();
        let lastMode: CameraMode | null = null;
        const camPos = new THREE.Vector3();
        const camLook = new THREE.Vector3();

        const toWorld = (x: number, y: number) => new THREE.Vector3(x / size.ppc - size.w / 2, 0, y / size.ppc - size.h / 2);

        const resize = () => {
            const w = mount.clientWidth, h = mount.clientHeight;
            if (!w || !h) return;
            renderer.setSize(w, h, false);
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
        };
        const ro = new ResizeObserver(resize);
        ro.observe(mount);
        resize();

        // ---- Grab the robot: left-drag = move, right-drag = rotate,
        //      two-finger twist (touch) = rotate. Same as the 2D view.
        const canvasEl = renderer.domElement;
        const raycaster = new THREE.Raycaster();
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const pointers = new Map<number, { x: number; y: number }>();
        type Grab =
            | { kind: 'move'; offX: number; offY: number }
            | { kind: 'rotate' }
            | { kind: 'twist'; startTouch: number; startRobot: number };
        let grab: Grab | null = null;

        const ndc = (cx: number, cy: number) => {
            const r = canvasEl.getBoundingClientRect();
            return new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
        };
        // Pointer -> canvas px on the floor (null if it misses the floor)
        const floorPoint = (cx: number, cy: number) => {
            raycaster.setFromCamera(ndc(cx, cy), camera);
            const hit = raycaster.ray.intersectPlane(floorPlane, new THREE.Vector3());
            if (!hit || !size.ppc) return null;
            return { x: (hit.x + size.w / 2) * size.ppc, y: (hit.z + size.h / 2) * size.ppc };
        };
        const hitsRobot = (cx: number, cy: number) => {
            if (!model) return false;
            raycaster.setFromCamera(ndc(cx, cy), camera);
            if (raycaster.intersectObject(model.group, true).length > 0) return true;
            // Generous fallback: pointer on the floor within ~10cm of the robot centre
            const robot = getRobot();
            const p = floorPoint(cx, cy);
            return !!robot && !!p && Math.hypot(p.x - robot.x, p.y - robot.y) < 10 * size.ppc;
        };
        const canGrab = () => {
            const robot = getRobot();
            return !!robot && !robot._isSimulationRunning && useStore.getState().simulationState !== 'running';
        };
        const twistAngle = () => {
            const [a, b] = [...pointers.values()];
            const pa = floorPoint(a.x, a.y), pb = floorPoint(b.x, b.y);
            return pa && pb ? Math.atan2(pb.y - pa.y, pb.x - pa.x) : null;
        };

        const onDown = (e: PointerEvent) => {
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const robot = getRobot();
            if (!robot || !canGrab()) return;

            // Second finger while grabbing -> twist rotate
            if (pointers.size === 2 && grab) {
                const a = twistAngle();
                if (a !== null) grab = { kind: 'twist', startTouch: a, startRobot: robot.angle };
                e.stopPropagation();
                return;
            }
            if (pointers.size > 1 || !hitsRobot(e.clientX, e.clientY)) return;

            // Capture phase: stop OrbitControls from also starting a camera drag
            e.stopPropagation();
            canvasEl.setPointerCapture(e.pointerId);
            if (e.button === 2) {
                grab = { kind: 'rotate' };
            } else {
                const p = floorPoint(e.clientX, e.clientY);
                grab = { kind: 'move', offX: p ? robot.x - p.x : 0, offY: p ? robot.y - p.y : 0 };
            }
            canvasEl.style.cursor = 'grabbing';
        };

        const onMove = (e: PointerEvent) => {
            if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const robot = getRobot();
            if (!grab) {
                // Hover feedback
                if (e.pointerType === 'mouse') canvasEl.style.cursor = canGrab() && hitsRobot(e.clientX, e.clientY) ? 'grab' : '';
                return;
            }
            if (!robot || !canGrab()) { grab = null; return; }
            e.stopPropagation();

            if (grab.kind === 'twist') {
                if (pointers.size < 2) return;
                const a = twistAngle();
                if (a !== null) setRobotPose(robot.x, robot.y, grab.startRobot + (a - grab.startTouch));
                return;
            }
            const p = floorPoint(e.clientX, e.clientY);
            if (!p) return;
            if (grab.kind === 'move') {
                const maxX = size.w * size.ppc, maxY = size.h * size.ppc;
                const x = Math.min(Math.max(p.x + grab.offX, 0), maxX);
                const y = Math.min(Math.max(p.y + grab.offY, 0), maxY);
                setRobotPose(x, y, robot.angle);
            } else {
                setRobotPose(robot.x, robot.y, Math.atan2(p.y - robot.y, p.x - robot.x));
            }
        };

        const onUp = (e: PointerEvent) => {
            pointers.delete(e.pointerId);
            if (!grab) return;
            e.stopPropagation();
            // Keep twisting until every finger is lifted
            if (grab.kind === 'twist' && pointers.size > 0) return;
            grab = null;
            canvasEl.style.cursor = '';
        };
        const onContextMenu = (e: Event) => e.preventDefault();

        // Capture phase on the wrapper runs before OrbitControls' own listeners
        mount.addEventListener('pointerdown', onDown, true);
        mount.addEventListener('pointermove', onMove, true);
        mount.addEventListener('pointerup', onUp, true);
        mount.addEventListener('pointercancel', onUp, true);
        canvasEl.addEventListener('contextmenu', onContextMenu);
        canvasEl.style.touchAction = 'none';

        const tick = (t: number) => {
            raf = requestAnimationFrame(tick);
            const dt = Math.min((t - lastT) / 1000, 0.1);
            lastT = t;
            const robot = getRobot();
            const trackCanvas = getTrackCanvas();
            if (!robot || !trackCanvas) { renderer.render(scene, camera); return; }

            // Track size / scale changed (new track selected)
            const ppc = robot.pixelsPerCm;
            if (ppc !== size.ppc || texture.image !== trackCanvas) {
                size = { w: trackCanvas.width / ppc, h: trackCanvas.height / ppc, ppc };
                mat.scale.set(size.w, size.h, 1);
                texture.image = trackCanvas;
                texture.needsUpdate = true;
                lastMode = null; // re-frame camera
            }
            // Floor texture is re-uploaded only when the 2D track changes
            if (trackDirty) { texture.needsUpdate = true; trackDirty = false; }

            // Robot instance is recreated on reset/track change
            if (robot !== modelRobot) {
                if (model) { scene.remove(model.group); model.oledTex.dispose(); }
                oledRev = -1;
                model = buildRobotModel(robot);
                modelRobot = robot;
                scene.add(model.group);
            }

            // Pose
            const pos = toWorld(robot.x, robot.y);
            model!.group.position.copy(pos);
            model!.group.rotation.y = -robot.angle;

            // Wheels spin with motor speed (visual only)
            const sim = robot._isSimulationRunning;
            const k = robot.speedScale / ppc / model!.wheelR;
            if (sim) {
                model!.wheels[0].rotation.z -= robot.lSpeed * k * dt; // left wheel (-z side)
                model!.wheels[1].rotation.z -= robot.rSpeed * k * dt;
            }
            const st0 = useStore.getState();
            applyHighlight(model!, st0.editorMode === 'learn' ? st0.highlightPart : null, t);
            [st0.robotPower, st0.motorPower].forEach((on, i) => {
                const cap = model!.switchCaps[i];
                cap.position.y = model!.capY + (on ? 0.05 : 0.175); // latched in = lower
            });
            if (oledRev !== robotUi.oled.revision) {
                model!.oledTex.image = robotUi.canvas; // getter re-renders the 128x64 picture
                oledRev = robotUi.oled.revision;
                model!.oledTex.needsUpdate = true;
            }
            (model!.nanoLed.material as Mat).color.set(robot.ledOn ? '#fb923c' : '#7f1d1d');
            (model!.nanoLed.material as Mat).emissive.set(robot.ledOn ? '#f97316' : '#000000');
            model!.leds.forEach((led, i) => {
                const on = robot.sensors[i] === 1;
                const m = led.material as THREE.MeshStandardMaterial;
                m.color.setHex(on ? COLORS.ledOn : COLORS.ledOff);
                m.emissive.setHex(on ? 0x991b1b : 0x000000);
            });

            // Shadow follows the robot
            sun.position.set(pos.x + 60, 120, pos.z + 40);
            sun.target.position.copy(pos);

            // Start / finish / waypoint markers
            const st = useStore.getState();
            const key = JSON.stringify([st.startPoint, st.finishPoint, st.waypoints, st.collectedWaypointIds, size.ppc]);
            if (key !== markersKey) {
                markersKey = key;
                markers.clear();
                if (st.startPoint) { const m = makeMarker(0x16a34a); m.position.copy(toWorld(st.startPoint.x, st.startPoint.y)); markers.add(m); }
                if (st.finishPoint) { const m = makeMarker(0xdc2626); m.position.copy(toWorld(st.finishPoint.x, st.finishPoint.y)); markers.add(m); }
                st.waypoints.forEach((wp, i) => {
                    const m = makeMarker(st.collectedWaypointIds.includes(i) ? 0x22c55e : 0xf59e0b, 10);
                    m.position.copy(toWorld(wp.x, wp.y));
                    markers.add(m);
                });
            }

            // Camera
            const mode = modeRef.current;
            if (grab) { renderer.render(scene, camera); return; }
            const fwd = new THREE.Vector3(Math.cos(robot.angle), 0, Math.sin(robot.angle));
            if (mode === 'chase') {
                controls.enabled = false;
                const desired = pos.clone().addScaledVector(fwd, -42).add(new THREE.Vector3(0, 26, 0));
                const look = pos.clone().addScaledVector(fwd, 18);
                if (lastMode !== 'chase') { camPos.copy(desired); camLook.copy(look); }
                const a = 1 - Math.exp(-dt * 5); // smooth follow
                camPos.lerp(desired, a);
                camLook.lerp(look, a);
                camera.position.copy(camPos);
                camera.lookAt(camLook);
            } else if (mode === 'top') {
                controls.enabled = false;
                const span = Math.max(size.w, size.h);
                camera.position.set(0, span * 1.05, 0.01);
                camera.lookAt(0, 0, 0);
            } else {
                controls.enabled = true;
                if (lastMode !== 'free') {
                    const span = Math.max(size.w, size.h);
                    camera.position.set(pos.x + span * 0.35, span * 0.45, pos.z + span * 0.45);
                    controls.target.copy(pos);
                }
                controls.update();
            }
            lastMode = mode;

            renderer.render(scene, camera);
        };
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('track-updated', onTrackUpdated);
            ro.disconnect();
            mount.removeEventListener('pointerdown', onDown, true);
            mount.removeEventListener('pointermove', onMove, true);
            mount.removeEventListener('pointerup', onUp, true);
            mount.removeEventListener('pointercancel', onUp, true);
            canvasEl.removeEventListener('contextmenu', onContextMenu);
            controls.dispose();
            scene.traverse(o => {
                const mesh = o as THREE.Mesh;
                if (mesh.isMesh) {
                    mesh.geometry.dispose();
                    const m = mesh.material as THREE.Material | THREE.Material[];
                    (Array.isArray(m) ? m : [m]).forEach(x => x.dispose());
                }
            });
            texture.dispose();
            renderer.dispose();
            mount.removeChild(renderer.domElement);
        };
    }, [getRobot, getTrackCanvas, setRobotPose]);

    const modes: [CameraMode, string][] = [['chase', t('v3d.follow')], ['free', t('v3d.free')], ['top', t('v3d.top')]];

    return (
        <div className="absolute inset-0">
            <div ref={mountRef} className="absolute inset-0 [&>canvas]:w-full [&>canvas]:h-full [&>canvas]:block" />
            <div className="absolute top-3 left-3 flex rounded-md border border-slate-300 bg-white/95 shadow-sm overflow-hidden text-xs font-medium">
                {modes.map(([m, label]) => (
                    <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`px-3 h-7 transition-colors ${mode === m ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className="absolute bottom-3 left-3 text-[11px] text-slate-500 bg-white/90 rounded px-2 py-1 border border-slate-200 pointer-events-none">
                {t('v3d.hint')}
                {mode === 'free' && <span className="hidden sm:inline">{t('v3d.hintFree')}</span>}
            </div>
        </div>
    );
};

export default Robot3DView;
