import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { Robot } from './Robot';
import { drawTrack } from './TrackPreset';
import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export const CanvasRenderer: React.FC = () => {
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

    const [isDrawing, setIsDrawing] = useState(false);
    const [isDraggingRobot, setIsDraggingRobot] = useState(false);
    const [isRotatingRobot, setIsRotatingRobot] = useState(false);
    const robotRef = useRef<Robot | null>(null);
    const animationRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const pixelsPerCmRef = useRef<number>(5.33);

    // Initialize Simulator
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Default start pos based on track
        const startX = activeTrack === 'scurve' ? 100 : 150;
        const startY = activeTrack === 'scurve' ? canvas.height - 100 : 150;
        const startAngle = activeTrack === 'scurve' ? -Math.PI / 2 : 0;

        // Calculate pixels per cm based on track dimensions and canvas size.
        // E.g. canvas is 800px. If track is 150x300cm, we need the largest dimension to fit 800px.
        // So pixelsPerCm = Math.min(800 / 150, 800 / 300) = 800 / 300 = 2.66
        const trackPhysicalWidth = activeTrack === 'upload' ? activeTrackWidthCm : 150;
        const trackPhysicalHeight = activeTrack === 'upload' ? activeTrackHeightCm : 150;
        const pixelsPerCm = Math.min(canvas.width / trackPhysicalWidth, canvas.height / trackPhysicalHeight);
        pixelsPerCmRef.current = pixelsPerCm;

        robotRef.current = new Robot(startX, startY, startAngle, pixelsPerCm);

        const renderTrack = async () => {
            const trackCanvas = trackCanvasRef.current;
            if (trackCanvas && trackCanvas.getContext('2d')) {
                const ctx = trackCanvas.getContext('2d')!;
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

                } else if (activeTrack !== 'upload') {
                    drawTrack(ctx, trackCanvas.width, trackCanvas.height, activeTrack as any, pixelsPerCm);
                }
                robotRef.current!.setContext(ctx);
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

        // Clear and draw track from offscreen canvas
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.drawImage(trackCanvas, 0, 0);

        // Update and draw robot
        robotRef.current.update(Math.min(dt, 0.1)); // cap dt to prevent huge jumps
        robotRef.current.draw(ctx);

        animationRef.current = requestAnimationFrame(draw);
    };

    // Run JS Simulation Code
    useEffect(() => {
        if (simulationState === 'running' && jsCode && robotRef.current) {
            robotRef.current._isSimulationRunning = true;

            const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
            try {
                const runner = new AsyncFunction('sim', jsCode);
                runner(robotRef.current).then(() => {
                    console.log("Simulation finished successfully");
                    setSimulationState('idle');
                }).catch((err: any) => {
                    console.log("Simulation ended or errored:", err);
                    setSimulationState('idle');
                });
            } catch (e) {
                console.error("Error parsing JS generated code", e);
                setSimulationState('idle');
            }
        } else if (simulationState === 'idle' && robotRef.current) {
            robotRef.current._isSimulationRunning = false;
            robotRef.current.lSpeed = 0;
            robotRef.current.rSpeed = 0;
        }
    }, [simulationState, jsCode, activeTrack, setSimulationState]);

    // Clear track listener
    useEffect(() => {
        const handleClear = () => {
            const trackCanvas = trackCanvasRef.current;
            if (trackCanvas && activeTrack === 'custom') {
                const ctx = trackCanvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, trackCanvas.width, trackCanvas.height);
                }
            }
        };
        window.addEventListener('clear-custom-track', handleClear);
        return () => window.removeEventListener('clear-custom-track', handleClear);
    }, [activeTrack]);

    // Mouse handlers for drawing custom tracks
    const getMousePos = (e: React.MouseEvent | React.TouchEvent) => {
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

        let clientX = 0;
        let clientY = 0;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        return {
            x: (clientX - rect.left - offsetX) * scaleX,
            y: (clientY - rect.top - offsetY) * scaleY
        };
    };

    const handleStartDraw = (e: React.MouseEvent | React.TouchEvent) => {
        if (simulationState === 'running') return;

        const { x, y } = getMousePos(e);

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
                return; // Don't draw
            }
        }

        // Only allow drawing on custom track with left click
        if (activeTrack !== 'custom' || ('button' in e && e.button !== 0)) return;

        setIsDrawing(true);
        const ctx = trackCanvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(x, y);
        }
    };

    const handleDraw = (e: React.MouseEvent | React.TouchEvent) => {
        if (simulationState === 'running') return;
        const { x, y } = getMousePos(e);

        if (isRotatingRobot && robotRef.current) {
            const dx = x - robotRef.current.x;
            const dy = y - robotRef.current.y;
            // Calculate angle towards mouse
            robotRef.current.angle = Math.atan2(dy, dx);
            robotRef.current.lSpeed = 0;
            robotRef.current.rSpeed = 0;
            return;
        }

        if (isDraggingRobot && robotRef.current) {
            robotRef.current.x = x;
            robotRef.current.y = y;
            // Clear physics speeds so it doesn't run away immediately upon drop if there was residual momentum
            robotRef.current.lSpeed = 0;
            robotRef.current.rSpeed = 0;
            return;
        }

        if (!isDrawing || activeTrack !== 'custom') return;

        const ctx = trackCanvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.lineWidth = 2.0 * pixelsPerCmRef.current;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = '#222';
            ctx.lineTo(x, y);
            ctx.stroke();
        }
    };

    const handleEndDraw = () => {
        setIsDrawing(false);
        setIsDraggingRobot(false);
        setIsRotatingRobot(false);
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
                    ${!isDraggingRobot && !isRotatingRobot && activeTrack === 'custom' && simulationState === 'idle' ? 'cursor-crosshair' : ''}
                    ${!isDraggingRobot && !isRotatingRobot && activeTrack !== 'custom' && simulationState === 'idle' ? 'cursor-grab' : ''}
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
};
