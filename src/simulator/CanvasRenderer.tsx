import { robotUi } from '../oled/robotUi';
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useStore } from '../store/useStore';
import { Robot } from './Robot';
import { drawTrack, MAZE_GRID, IMAGE_TRACKS, isImageTrack } from './TrackPreset';
import { beep } from './beep';
import { QLearningAgent } from '../qlearning/QLearningAgent';
import { tr } from '../i18n/i18n';
import { compileIno, createSketchRuntime, SketchEnd } from '../code/inoTranspiler';

// The track canvas is read back every frame (sensors), so keep it in CPU memory
const TRACK_CTX: CanvasRenderingContext2DSettings = { willReadFrequently: true };
// Tells the 3D view to re-upload the track texture
const notifyTrack = () => window.dispatchEvent(new Event('track-updated'));

export interface CanvasRendererHandle {
    getTrackCanvas: () => HTMLCanvasElement | null;
    getRobot: () => Robot | null;
    /** Move/rotate the robot while idle; also becomes the new start/reset pose. */
    setRobotPose: (x: number, y: number, angle: number) => void;
}

export const CanvasRenderer = forwardRef<CanvasRendererHandle>((_, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const trackCanvasRef = useRef<HTMLCanvasElement>(null); // Offscreen canvas for track reading

    const jsCode = useStore(state => state.jsCode);
    const simulationState = useStore(state => state.simulationState);
    const activeTrack = useStore(state => state.activeTrack);
    const customTrackSrc = useStore(state => state.customTrackSrc);
    const customTrackType = useStore(state => state.customTrackType);
    const activeTrackWidthCm = useStore(state => state.activeTrackWidthCm);
    const activeTrackHeightCm = useStore(state => state.activeTrackHeightCm);
    const setSimulationState = useStore(state => state.setSimulationState);
    const editorMode = useStore(state => state.editorMode);
    const bestActions = useStore(state => state.bestActions);
    const trainingPower = useStore(state => state.trainingPower);
    // Subscribe to trigger re-renders (draw loop reads via getState())
    const _startPoint = useStore(state => state.startPoint);
    const _finishPoint = useStore(state => state.finishPoint);
    const _waypoints = useStore(state => state.waypoints);
    const _collectedIds = useStore(state => state.collectedWaypointIds);
    void _startPoint; void _finishPoint; void _waypoints; void _collectedIds;
    const placementMode = useStore(state => state.placementMode);
    const setStartPoint = useStore(state => state.setStartPoint);
    const setFinishPoint = useStore(state => state.setFinishPoint);
    const addWaypoint = useStore(state => state.addWaypoint);
    const setPlacementMode = useStore(state => state.setPlacementMode);

    const [isDrawing, setIsDrawing] = useState(false);
    const [isDraggingRobot, setIsDraggingRobot] = useState(false);
    const [isRotatingRobot, setIsRotatingRobot] = useState(false);
    const robotRef = useRef<Robot | null>(null);
    const animationRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const pixelsPerCmRef = useRef<number>(5.33);
    const startPosRef = useRef({ x: 0, y: 0, angle: 0 });
    const runTokenRef = useRef(0);

    // Expose refs to parent via imperative handle
    useImperativeHandle(ref, () => ({
        getTrackCanvas: () => trackCanvasRef.current,
        getRobot: () => robotRef.current,
        setRobotPose: (x: number, y: number, angle: number) => {
            const robot = robotRef.current;
            if (!robot || robot._isSimulationRunning) return;
            robot.x = x;
            robot.y = y;
            robot.angle = angle;
            robot.stopWheels();
            startPosRef.current = { x, y, angle };
        },
    }));

    // Initialize Simulator
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Default start pos based on track
        const imageTrack = isImageTrack(activeTrack) ? IMAGE_TRACKS[activeTrack] : null;
        const startX = imageTrack ? imageTrack.start.x : activeTrack === 'scurve' ? 100 : activeTrack === 'maze' ? MAZE_GRID.margin : 150;
        const startY = imageTrack ? imageTrack.start.y : activeTrack === 'scurve' ? canvas.height - 100 : activeTrack === 'maze' ? MAZE_GRID.margin : 150;
        const startAngle = imageTrack ? imageTrack.start.angle : activeTrack === 'scurve' ? -Math.PI / 2 : 0;

        // Calculate pixels per cm based on track dimensions and canvas size.
        // E.g. canvas is 800px. If track is 150x300cm, we need the largest dimension to fit 800px.
        // So pixelsPerCm = Math.min(800 / 150, 800 / 300) = 800 / 300 = 2.66
        const trackPhysicalWidth = activeTrack === 'upload' ? activeTrackWidthCm : imageTrack ? imageTrack.sizeCm : 150;
        const trackPhysicalHeight = activeTrack === 'upload' ? activeTrackHeightCm : imageTrack ? imageTrack.sizeCm : 150;
        const pixelsPerCm = Math.min(canvas.width / trackPhysicalWidth, canvas.height / trackPhysicalHeight);
        pixelsPerCmRef.current = pixelsPerCm;

        robotRef.current = new Robot(startX, startY, startAngle, pixelsPerCm);
        startPosRef.current = { x: startX, y: startY, angle: startAngle };

        const renderTrack = async () => {
            const trackCanvas = trackCanvasRef.current;
            if (trackCanvas && trackCanvas.getContext('2d', TRACK_CTX)) {
                const ctx = trackCanvas.getContext('2d', TRACK_CTX)!;
                if (activeTrack === 'custom') {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, trackCanvas.width, trackCanvas.height);
                } else if (activeTrack === 'upload' && customTrackSrc) {
                    // Check if PDF or Image
                    // Because object URL doesn't always have extension, we try image first, if error try PDF
                    try {
                        // Render white bg first
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, trackCanvas.width, trackCanvas.height);

                        if (customTrackType === 'pdf') {
                            // pdf.js is large: load it only when a PDF track is used
                            const pdfjsLib = await import('pdfjs-dist');
                            pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
                            const loadingTask = pdfjsLib.getDocument(customTrackSrc);
                            const pdf = await loadingTask.promise;
                            const page = await pdf.getPage(1);

                            // Scale to fit canvas
                            const viewport = page.getViewport({ scale: 1 });
                            const scale = Math.min(trackCanvas.width / viewport.width, trackCanvas.height / viewport.height);
                            const scaledViewport = page.getViewport({ scale });

                            // Center it
                            const offsetX = (trackCanvas.width - scaledViewport.width) / 2;
                            const offsetY = (trackCanvas.height - scaledViewport.height) / 2;

                            ctx.translate(offsetX, offsetY);
                            await page.render({ canvasContext: ctx as any, viewport: scaledViewport as any } as any).promise;
                            ctx.translate(-offsetX, -offsetY);
                        } else {
                            // Assume image
                            const img = new Image();
                            img.src = customTrackSrc;
                            await new Promise((resolve, reject) => {
                                img.onload = resolve;
                                img.onerror = reject;
                            });
                            // Draw image scaled to fill/fit
                            const scale = Math.min(trackCanvas.width / img.width, trackCanvas.height / img.height);
                            const drawW = img.width * scale;
                            const drawH = img.height * scale;
                            const offsetX = (trackCanvas.width - drawW) / 2;
                            const offsetY = (trackCanvas.height - drawH) / 2;
                            ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
                        }

                    } catch (e) {
                        console.error("Failed to render uploaded track", e);
                    }

                } else if (imageTrack) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, trackCanvas.width, trackCanvas.height);
                    try {
                        const img = new Image();
                        img.src = imageTrack.src;
                        await img.decode();
                        if (useStore.getState().activeTrack !== activeTrack) return; // switched meanwhile
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(img, 0, 0, trackCanvas.width, trackCanvas.height);
                    } catch (e) {
                        console.error('Failed to load preset track', e);
                    }
                } else if (activeTrack !== 'upload') {
                    drawTrack(ctx, trackCanvas.width, trackCanvas.height, activeTrack as any, pixelsPerCm);
                }
                robotRef.current!.setContext(ctx);
                notifyTrack();
            }
        };

        renderTrack();

        // Initial draw
        draw(0);

        return () => cancelAnimationFrame(animationRef.current!);
    }, [activeTrack, customTrackSrc, customTrackType, activeTrackWidthCm, activeTrackHeightCm]);

    // Main game loop
    const draw = (time: number) => {
        const ctx = canvasRef.current?.getContext('2d');
        const trackCanvas = trackCanvasRef.current;
        if (!ctx || !trackCanvas || !robotRef.current) return;

        const dt = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;

        const st = useStore.getState();
        robotUi.tick(Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.1) : 0, robotRef.current);

        if (st.viewMode === '3d') {
            if (!robotRef.current.fastMode) robotRef.current.frame(Math.min(dt, 0.1));
            robotRef.current.readSensors(); // sensor LEDs + sensor strip
            animationRef.current = requestAnimationFrame(draw);
            return;
        }

        // Clear and draw track from offscreen canvas
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.drawImage(trackCanvas, 0, 0);

        // Update and draw robot (Learn tab highlights the selected hardware part)
        const highlight = st.editorMode === 'learn' ? st.highlightPart : null;
        const extras = { oled: robotUi.canvas, powerOn: st.robotPower, motorOn: st.motorPower };
        if (robotRef.current.fastMode) {
            // In fast training mode, do not run standard updates in game loop
            // to avoid conflicts with background calculations. We just draw the robot's current position.
            robotRef.current.draw(ctx, highlight, extras);
        } else {
            robotRef.current.frame(Math.min(dt, 0.1)); // cap dt to prevent huge jumps
            robotRef.current.draw(ctx, highlight, extras);
        }

        // Draw Start Point marker (green flag)
        const sp = useStore.getState().startPoint;
        if (sp) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, 12, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#16a34a';
            ctx.stroke();
            // Flag pole
            ctx.beginPath();
            ctx.moveTo(sp.x, sp.y + 12);
            ctx.lineTo(sp.x, sp.y - 20);
            ctx.strokeStyle = '#16a34a';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Flag triangle
            ctx.beginPath();
            ctx.moveTo(sp.x, sp.y - 20);
            ctx.lineTo(sp.x + 14, sp.y - 14);
            ctx.lineTo(sp.x, sp.y - 8);
            ctx.closePath();
            ctx.fillStyle = '#22c55e';
            ctx.fill();
            // Label
            ctx.font = 'bold 10px sans-serif';
            ctx.fillStyle = '#16a34a';
            ctx.textAlign = 'center';
            ctx.fillText('START', sp.x, sp.y + 26);
            ctx.restore();
        }

        // Draw Finish Point marker (red flag)
        const fp = useStore.getState().finishPoint;
        if (fp) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(fp.x, fp.y, 12, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#dc2626';
            ctx.stroke();
            // Flag pole
            ctx.beginPath();
            ctx.moveTo(fp.x, fp.y + 12);
            ctx.lineTo(fp.x, fp.y - 20);
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 2;
            ctx.stroke();
            // Checkered flag
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(fp.x, fp.y - 20, 14, 6);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(fp.x, fp.y - 14, 14, 6);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(fp.x + 7, fp.y - 20, 7, 6);
            ctx.strokeStyle = '#dc2626';
            ctx.lineWidth = 1;
            ctx.strokeRect(fp.x, fp.y - 20, 14, 12);
            // Label
            ctx.font = 'bold 10px sans-serif';
            ctx.fillStyle = '#dc2626';
            ctx.textAlign = 'center';
            ctx.fillText('FINISH', fp.x, fp.y + 26);
            ctx.restore();
        }

        // Draw Waypoint markers (amber = uncollected, green = collected)
        const wps = useStore.getState().waypoints;
        const collectedIds = useStore.getState().collectedWaypointIds;
        wps.forEach((wp, i) => {
            const isCollected = collectedIds.includes(i);
            ctx.save();
            // Outer circle
            ctx.beginPath();
            ctx.arc(wp.x, wp.y, 14, 0, Math.PI * 2);
            ctx.fillStyle = isCollected ? 'rgba(34, 197, 94, 0.25)' : 'rgba(245, 158, 11, 0.25)';
            ctx.fill();
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = isCollected ? '#22c55e' : '#f59e0b';
            ctx.stroke();
            // Inner circle
            ctx.beginPath();
            ctx.arc(wp.x, wp.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = isCollected ? '#22c55e' : '#f59e0b';
            ctx.fill();
            // Number or checkmark
            ctx.font = 'bold 10px sans-serif';
            ctx.fillStyle = isCollected ? '#fff' : '#000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(isCollected ? '✓' : `${i + 1}`, wp.x, wp.y);
            // Label
            ctx.font = 'bold 9px sans-serif';
            ctx.fillStyle = isCollected ? '#22c55e' : '#f59e0b';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(`P${i + 1}`, wp.x, wp.y + 26);
            ctx.restore();
        });

        // Draw placement mode indicator
        const pm = useStore.getState().placementMode;
        if (pm !== 'none') {
            ctx.save();
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            const colors: Record<string, string> = { start: '#22c55e', finish: '#ef4444', waypoint: '#f59e0b' };
            ctx.fillStyle = colors[pm] || '#fff';
            ctx.fillText(tr('tr.placeHint', { kind: tr(`tr.kind.${pm}` as Parameters<typeof tr>[0]) }), 400, 30);
            ctx.restore();
        }

        animationRef.current = requestAnimationFrame(draw);
    };

    // Run JS Simulation Code
    useEffect(() => {
        if (simulationState !== 'running' || !robotRef.current) {
            if (robotRef.current) {
                robotRef.current._isSimulationRunning = false;
                robotRef.current.stopWheels();
            }
            return;
        }

        robotRef.current._isSimulationRunning = true;
        robotRef.current.fastMode = false;
        robotRef.current.resetRunState();

        // Start each run from the home position so behavior is reproducible
        // across repeated Simulate clicks (no cross-run position drift).
        const home = startPosRef.current;
        robotRef.current.x = home.x;
        robotRef.current.y = home.y;
        robotRef.current.angle = home.angle;

        // Token guard: a stale runner that aborts after a newer run started
        // must not flip the active run back to idle.
        const token = ++runTokenRef.current;

        if (editorMode === 'ai') {
            // Mode AI Training: replay best episode actions
            const actions = useStore.getState().bestActions;
            const power = useStore.getState().trainingPower;
            const robot = robotRef.current;
            (async () => {
                try {
                    for (const a of actions) {
                        if (!robot._isSimulationRunning) break;
                        await QLearningAgent.runAction(robot, a.actionId, power);
                        if (robot._isSimulationRunning) beep();
                    }
                    console.log('AI replay finished');
                } catch (err) {
                    console.log('AI replay ended:', err);
                } finally {
                    if (runTokenRef.current === token) setSimulationState('idle');
                }
            })();
        } else if (editorMode === 'code') {
            // Code tab: translate the hand-written .ino and run it
            const robot = robotRef.current;
            const done = () => { robot.lSpeed = 0; robot.rSpeed = 0; if (runTokenRef.current === token) setSimulationState('idle'); };
            try {
                const run = compileIno(useStore.getState().sketchCode);
                const { my, rt } = createSketchRuntime(robot);
                run(my, rt).catch((err: unknown) => {
                    if (err instanceof SketchEnd || !robot._isSimulationRunning) return;
                    window.dispatchEvent(new CustomEvent('sketch-error', { detail: (err as Error).message ?? String(err) }));
                }).finally(done);
            } catch (e) {
                console.error('Sketch could not be compiled', e);
                done();
            }
        } else {
            // Mode Blockly: jalankan kode JS dari Blockly
            if (!jsCode) { setSimulationState('idle'); return; }
            const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
            try {
                const runner = new AsyncFunction('sim', jsCode);
                // Wrap each command called by the Blockly code so it beeps once it has
                // fully finished. Nested calls inside Robot (e.g. rl -> tright) use the
                // real robot via `this`, so they don't beep on their own.
                const robot = robotRef.current;
                const sim = new Proxy(robot, {
                    get(target, prop, receiver) {
                        const value = Reflect.get(target, prop, receiver);
                        if (typeof value !== 'function') return value;
                        return async (...args: unknown[]) => {
                            const result = await value.apply(target, args);
                            if (target._isSimulationRunning) beep();
                            return result;
                        };
                    },
                });
                runner(sim).then(() => {
                    console.log("Simulation finished successfully");
                    if (runTokenRef.current === token) setSimulationState('idle');
                }).catch((err: unknown) => {
                    console.log("Simulation ended or errored:", err);
                    if (runTokenRef.current === token) setSimulationState('idle');
                });
            } catch (e) {
                console.error("Error parsing JS generated code", e);
                if (runTokenRef.current === token) setSimulationState('idle');
            }
        }
    }, [simulationState, jsCode, activeTrack, editorMode, bestActions, trainingPower, setSimulationState]);

    // Clear and reset listeners
    useEffect(() => {
        const handleClear = () => {
            const trackCanvas = trackCanvasRef.current;
            if (trackCanvas && activeTrack === 'custom') {
                const ctx = trackCanvas.getContext('2d', TRACK_CTX);
                if (ctx) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, trackCanvas.width, trackCanvas.height);
                    notifyTrack();
                }
            }
        };

        const handleReset = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const startX = startPosRef.current.x;
            const startY = startPosRef.current.y;
            const startAngle = startPosRef.current.angle;

            robotRef.current = new Robot(startX, startY, startAngle, pixelsPerCmRef.current);
            const trackCanvas = trackCanvasRef.current;
            if (trackCanvas && trackCanvas.getContext('2d', TRACK_CTX)) {
                robotRef.current.setContext(trackCanvas.getContext('2d', TRACK_CTX)!);
            }
            // Main rAF loop (started in the init effect) already renders every
            // frame, so we don't call draw() here — that would spawn a duplicate
            // requestAnimationFrame chain whose physics updates pile up across
            // repeated resets and corrupt robot motion.
        };

        window.addEventListener('clear-custom-track', handleClear);
        window.addEventListener('reset-simulation', handleReset);
        return () => {
            window.removeEventListener('clear-custom-track', handleClear);
            window.removeEventListener('reset-simulation', handleReset);
        };
    }, [activeTrack]);

    // Mouse handlers for drawing custom tracks
    const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
        if ('touches' in e) {
            const t = e.touches[0] ?? e.changedTouches[0];
            return clientToCanvas(t.clientX, t.clientY);
        }
        return clientToCanvas(e.clientX, e.clientY);
    };

    const clientToCanvas = (clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        // To account for object-contain, we need to correctly map the display rect
        // and internal canvas resolution (800x800)
        const canvasAspectRatio = canvas.width / canvas.height;
        const rectAspectRatio = rect.width / rect.height;

        let displayWidth = rect.width;
        let displayHeight = rect.height;
        let offsetX = 0;
        let offsetY = 0;

        if (canvasAspectRatio > rectAspectRatio) {
            // Letterbox top/bottom
            displayHeight = rect.width / canvasAspectRatio;
            offsetY = (rect.height - displayHeight) / 2;
        } else {
            // Letterbox left/right
            displayWidth = rect.height * canvasAspectRatio;
            offsetX = (rect.width - displayWidth) / 2;
        }

        const scaleX = canvas.width / displayWidth;
        const scaleY = canvas.height / displayHeight;

        return {
            x: (clientX - rect.left - offsetX) * scaleX,
            y: (clientY - rect.top - offsetY) * scaleY
        };
    };

    // Mobile rotate: two-finger twist on the robot (desktop uses right-click drag)
    const twistRef = useRef<{ startTouchAngle: number; startRobotAngle: number } | null>(null);
    // True while a touch is moving/rotating the robot or drawing, so the browser
    // must not scroll or pinch-zoom the page at the same time.
    const touchGestureRef = useRef(false);
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const block = (ev: TouchEvent) => {
            if (touchGestureRef.current && ev.cancelable) ev.preventDefault();
        };
        canvas.addEventListener('touchmove', block, { passive: false });
        return () => canvas.removeEventListener('touchmove', block);
    }, []);
    const touchAngle = (e: React.TouchEvent) => {
        const a = clientToCanvas(e.touches[0].clientX, e.touches[0].clientY);
        const b = clientToCanvas(e.touches[1].clientX, e.touches[1].clientY);
        return { angle: Math.atan2(b.y - a.y, b.x - a.x), a, b };
    };
    const isNearRobot = (x: number, y: number, margin = 50) =>
        !!robotRef.current && Math.abs(x - robotRef.current.x) < margin && Math.abs(y - robotRef.current.y) < margin;

    const handleStartDraw = (e: React.MouseEvent | React.TouchEvent) => {
        if (simulationState === 'running') return;

        // Second finger down: switch to rotate if the gesture is on/around the robot
        if ('touches' in e && e.touches.length === 2 && robotRef.current) {
            const { angle, a, b } = touchAngle(e);
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            if (isDraggingRobot || isNearRobot(a.x, a.y, 80) || isNearRobot(b.x, b.y, 80) || isNearRobot(mid.x, mid.y, 80)) {
                twistRef.current = { startTouchAngle: angle, startRobotAngle: robotRef.current.angle };
                touchGestureRef.current = true;
                setIsDrawing(false);
                setIsDraggingRobot(false);
                setIsRotatingRobot(true);
            }
            return;
        }

        const { x, y } = getMousePos(e);

        // Check if we're in placement mode (setting start/finish/waypoint)
        const currentPlacementMode = useStore.getState().placementMode;
        if (currentPlacementMode !== 'none') {
            if (currentPlacementMode === 'start') {
                setStartPoint({ x, y });
                if (robotRef.current) {
                    robotRef.current.x = x;
                    robotRef.current.y = y;
                    startPosRef.current = { x, y, angle: robotRef.current.angle };
                }
                setPlacementMode('none');
            } else if (currentPlacementMode === 'finish') {
                setFinishPoint({ x, y });
                setPlacementMode('none');
            } else if (currentPlacementMode === 'waypoint') {
                addWaypoint({ x, y });
                // Stay in waypoint mode for placing multiple points!
                // User clicks "Add Waypoint" button again to exit mode
            }
            return;
        }

        // Check if user is clicking on the robot
        if (robotRef.current) {
            const rx = robotRef.current.x;
            const ry = robotRef.current.y;
            // Simple bound box check
            if (Math.abs(x - rx) < 50 && Math.abs(y - ry) < 50) {
                if ('button' in e && e.button === 2) {
                    setIsRotatingRobot(true);
                } else {
                    setIsDraggingRobot(true);
                }
                touchGestureRef.current = true;
                return; // Don't draw
            }
        }

        // Only allow drawing on custom track with left click
        if (activeTrack !== 'custom' || ('button' in e && e.button !== 0)) return;

        setIsDrawing(true);
        touchGestureRef.current = true;
        const ctx = trackCanvasRef.current?.getContext('2d', TRACK_CTX);
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
    };

    const handleDraw = (e: React.MouseEvent | React.TouchEvent) => {
        if (simulationState === 'running') return;

        if (twistRef.current && 'touches' in e && e.touches.length === 2 && robotRef.current) {
            const { angle } = touchAngle(e);
            robotRef.current.angle = twistRef.current.startRobotAngle + (angle - twistRef.current.startTouchAngle);
            robotRef.current.stopWheels();
            return;
        }
        if (twistRef.current) return; // one finger lifted mid-twist: ignore until all fingers up

        const { x, y } = getMousePos(e);

        if (isRotatingRobot && robotRef.current) {
            const dx = x - robotRef.current.x;
            const dy = y - robotRef.current.y;
            // Calculate angle towards mouse
            robotRef.current.angle = Math.atan2(dy, dx);
            robotRef.current.stopWheels();
            return;
        }

        if (isDraggingRobot && robotRef.current) {
            robotRef.current.x = x;
            robotRef.current.y = y;
            // Clear physics speeds so it doesn't run away immediately upon drop if there was residual momentum
            robotRef.current.stopWheels();
            return;
        }

        if (!isDrawing || activeTrack !== 'custom') return;

        const ctx = trackCanvasRef.current?.getContext('2d', TRACK_CTX);
        if (ctx) {
            ctx.lineWidth = 2.0 * pixelsPerCmRef.current;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#222';
            ctx.lineTo(x, y);
            ctx.stroke();
            notifyTrack();
        }
    };

    const handleEndDraw = (e?: React.MouseEvent | React.TouchEvent) => {
        // Keep rotating while at least one finger of a twist is still down
        if (e && 'touches' in e && e.touches.length > 0 && twistRef.current) return;
        twistRef.current = null;
        touchGestureRef.current = false;
        // Hanya update startPos bila user benar-benar drag/rotate robot.
        // Sebelumnya startPosRef tertimpa pada setiap mouseUp idle (termasuk klik
        // biasa di canvas setelah simulate) -> Reset pakai posisi salah. (bugfix)
        const moved = isDraggingRobot || isRotatingRobot;
        setIsDrawing(false);
        setIsDraggingRobot(false);
        setIsRotatingRobot(false);

        if (moved && robotRef.current && simulationState === 'idle') {
            startPosRef.current = { x: robotRef.current.x, y: robotRef.current.y, angle: robotRef.current.angle };
        }
    };

    return (
        <>
            <canvas
                ref={trackCanvasRef}
                width={800}
                height={800}
                className="hidden"
            />
            <canvas
                ref={canvasRef}
                width={800}
                height={800}
                className={`w-full h-full object-contain bg-white 
                    ${isDraggingRobot ? 'cursor-grabbing' : ''}
                    ${isRotatingRobot ? 'cursor-alias' : ''}
                    ${placementMode !== 'none' ? 'cursor-crosshair' : ''}
                    ${placementMode === 'none' && !isDraggingRobot && !isRotatingRobot && activeTrack === 'custom' && simulationState === 'idle' ? 'cursor-crosshair' : ''}
                    ${placementMode === 'none' && !isDraggingRobot && !isRotatingRobot && activeTrack !== 'custom' && simulationState === 'idle' ? 'cursor-grab' : ''}
                    ${simulationState === 'running' ? 'cursor-default' : ''}
                `}
                onContextMenu={(e) => { e.preventDefault(); }} // prevent default right-click menu
                onMouseDown={handleStartDraw}
                onMouseMove={handleDraw}
                onMouseUp={handleEndDraw}
                onMouseLeave={handleEndDraw}
                onTouchStart={handleStartDraw}
                onTouchMove={handleDraw}
                onTouchEnd={handleEndDraw}
            />
        </>
    );
});
