import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useStore } from '../store/useStore';
import type { Robot } from './Robot';

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
    body: 0x0f766e,
    battery: 0xdc2626,
    wheel: 0x1f2937,
    hub: 0xbe123c,
    stem: 0xe2e8f0,
    head: 0x1e3a8a,
    ledOff: 0xf8fafc,
    ledOn: 0xef4444,
};

function buildRobotModel(robot: Robot) {
    const ppc = robot.pixelsPerCm;
    const L = robot.PHYSICAL_HEIGHT_CM; // 18.5
    const group = new THREE.Group();
    const mat = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
        new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...extra });

    const bodyW = L * 0.45; // lateral (z)
    const bodyD = L * 0.35; // longitudinal (x)
    const wheelR = 2.0;
    const wheelT = 1.5;

    // Chassis plate
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(bodyD, 0.4, bodyW), mat(COLORS.body));
    chassis.position.set(0, wheelR, 0);
    group.add(chassis);

    // Battery pack
    const batt = new THREE.Mesh(new THREE.BoxGeometry(bodyD * 0.6, 1.8, bodyW * 0.6), mat(COLORS.battery));
    batt.position.set(-bodyD * 0.05, wheelR + 1.1, 0);
    group.add(batt);

    // Wheels (spin with motor speed)
    const wheels: THREE.Group[] = [];
    for (const side of [-1, 1]) {
        const wheel = new THREE.Group();
        const tyre = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, wheelT, 28), mat(COLORS.wheel, { roughness: 0.9 }));
        tyre.rotation.x = Math.PI / 2;
        const hub = new THREE.Mesh(new THREE.BoxGeometry(wheelR * 1.4, wheelR * 0.35, wheelT + 0.1), mat(COLORS.hub));
        wheel.add(tyre, hub);
        wheel.position.set(0, wheelR, side * (bodyW / 2 + wheelT / 2 + 0.3));
        group.add(wheel);
        wheels.push(wheel);
    }

    // Front caster
    const caster = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), mat(0x94a3b8, { metalness: 0.6 }));
    caster.position.set(L * 0.32, 0.6, 0);
    group.add(caster);

    // Stem from chassis to sensor bar
    const sensorH = 0.9;
    const stemStart = bodyD * 0.3;
    const stemEnd = L * 0.45;
    const stem = new THREE.Mesh(new THREE.BoxGeometry(stemEnd - stemStart, 0.4, bodyW * 0.25), mat(COLORS.stem));
    stem.position.set((stemStart + stemEnd) / 2, (wheelR + sensorH) / 2 + 0.6, 0);
    stem.rotation.z = -Math.atan2(wheelR - sensorH, stemEnd - stemStart) * 0.6;
    group.add(stem);

    // Sensor bar following the real M-shaped sensor layout
    const pts = Array.from({ length: 8 }, (_, i) => {
        const p = robot.getSensorLocalPosition(i);
        return new THREE.Vector3(p.forwardX / ppc, sensorH, p.rightY / ppc);
    });
    const headMat = mat(COLORS.head);
    for (let i = 0; i < 7; i++) {
        const a = pts[i], b = pts[i + 1];
        const len = a.distanceTo(b) + 1.2;
        const seg = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, len), headMat);
        seg.position.copy(a).add(b).multiplyScalar(0.5);
        seg.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        group.add(seg);
    }

    // Sensor LEDs on top of the bar (red when the sensor sees the line)
    const leds = pts.map(p => {
        const led = new THREE.Mesh(
            new THREE.SphereGeometry(0.45, 12, 8),
            new THREE.MeshStandardMaterial({ color: COLORS.ledOff, emissive: 0x000000 }),
        );
        led.position.set(p.x, p.y + 0.35, p.z);
        group.add(led);
        return led;
    });

    group.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; } });
    return { group, wheels, leds, wheelR };
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
    const modeRef = useRef<CameraMode>(mode);

    useEffect(() => { modeRef.current = mode; }, [mode]);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
        let modelRobot: Robot | null = null;
        let size = { w: 0, h: 0, ppc: 0 };
        let markersKey = '';
        let frame = 0;
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
            // Refresh floor texture periodically (custom drawing, async image load)
            if (++frame % 10 === 0) texture.needsUpdate = true;

            // Robot instance is recreated on reset/track change
            if (robot !== modelRobot) {
                if (model) scene.remove(model.group);
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

    const modes: [CameraMode, string][] = [['chase', 'Follow'], ['free', 'Free'], ['top', 'Top']];

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
                Robot: drag to move · right-drag or two-finger twist to rotate
                {mode === 'free' && <span className="hidden sm:inline"> · Camera: drag to orbit, scroll to zoom</span>}
            </div>
        </div>
    );
};

export default Robot3DView;
