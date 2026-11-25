import React from 'react';
import { GripHorizontal, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { LIB_VERSIONS } from '../blockly/inoTemplate';
import { useT } from '../i18n/i18n';
import { robotUi, type UiButton } from './robotUi';

// Floating window with the robot's OLED and its six buttons, laid out like the
// board: left column POWER / UP / DOWN, right column MOTOR / OK / BACK.
// Drag it by the title bar, resize it from the bottom-right corner.

const KEYS: Record<string, UiButton> = { ArrowUp: 'up', ArrowDown: 'down', Enter: 'ok', Escape: 'back', Backspace: 'back' };
const GEOM_KEY = 'mrb_robot_panel';
const MIN_W = 240;
const MAX_W = 640;

interface Geom { x: number; y: number; w: number; }

const clampGeom = (g: Geom): Geom => {
    const w = Math.max(MIN_W, Math.min(MAX_W, g.w, window.innerWidth - 8));
    return {
        w,
        x: Math.max(4 - w + 80, Math.min(window.innerWidth - 80, g.x)), // keep at least 80 px visible
        y: Math.max(0, Math.min(window.innerHeight - 44, g.y)), // title bar stays reachable
    };
};

const readGeom = (): Geom => {
    try {
        const g = JSON.parse(localStorage.getItem(GEOM_KEY) ?? '');
        if (typeof g?.x === 'number' && typeof g?.y === 'number' && typeof g?.w === 'number') return clampGeom(g);
    } catch { /* first open or storage unavailable */ }
    const w = Math.min(340, window.innerWidth - 16);
    return clampGeom({ w, x: window.innerWidth - w - 16, y: window.innerHeight - w * 0.62 - 140 });
};

const Tactile: React.FC<{ btn: UiButton; label: string; disabled: boolean; size: number }> = ({ btn, label, disabled, size }) => {
    const [down, setDown] = React.useState(false);
    const start = (e: React.PointerEvent) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDown(true);
        robotUi.press(btn);
    };
    const end = () => {
        if (!down) return;
        setDown(false);
        robotUi.release(btn);
    };
    return (
        <div className="flex flex-col items-center gap-0.5">
            <button
                type="button"
                disabled={disabled}
                onPointerDown={start}
                onPointerUp={end}
                onPointerCancel={end}
                onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !disabled) { e.preventDefault(); e.stopPropagation(); robotUi.press(btn); setDown(true); } }}
                onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.stopPropagation(); end(); } }}
                aria-label={label}
                style={{ width: size, height: size }}
                className="rounded-md bg-slate-800 border border-slate-900 flex items-center justify-center shadow-sm touch-none select-none disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
                <span style={{ width: size * 0.55, height: size * 0.55 }} className={`rounded-full border border-slate-400 transition-transform ${down ? 'scale-90 bg-slate-300' : 'bg-slate-200'}`} />
            </button>
            <span className="text-[10px] font-semibold tracking-wide text-slate-600">{label}</span>
        </div>
    );
};

const Latch: React.FC<{ label: string; on: boolean; onToggle: () => void; size: number }> = ({ label, on, onToggle, size }) => {
    const t = useT();
    return (
        <div className="flex flex-col items-center gap-0.5">
            <button
                type="button"
                onClick={onToggle}
                aria-pressed={on}
                aria-label={t('rp.switch', { label })}
                style={{ width: size, height: size }}
                className="relative rounded-md bg-slate-700 border border-slate-900 flex items-center justify-center shadow-sm select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
                <span style={{ width: size * (on ? 0.55 : 0.72), height: size * (on ? 0.55 : 0.72) }} className={`rounded-sm border transition-all ${on ? 'bg-slate-300 border-slate-400' : 'bg-white border-slate-300 shadow'}`} />
                <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border border-white ${on ? 'bg-emerald-500' : 'bg-slate-400'}`} />
            </button>
            <span className="text-[10px] font-semibold tracking-wide text-slate-600 whitespace-nowrap">
                {label} <span className={on ? 'text-emerald-600' : 'text-slate-400'}>{on ? t('rp.on') : t('rp.off')}</span>
            </span>
        </div>
    );
};

export const RobotPanel: React.FC = () => {
    const open = useStore(s => s.robotPanelOpen);
    const setOpen = useStore(s => s.setRobotPanelOpen);
    const robotPower = useStore(s => s.robotPower);
    const motorPower = useStore(s => s.motorPower);
    const setRobotPower = useStore(s => s.setRobotPower);
    const setMotorPower = useStore(s => s.setMotorPower);
    const version = useStore(s => s.libraryVersion);
    const t = useT();
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = React.useState(robotUi.status);
    const [geom, setGeom] = React.useState<Geom>(readGeom);
    const drag = React.useRef<{ kind: 'move' | 'resize'; px: number; py: number; g: Geom } | null>(null);

    // Remember where the window was left
    React.useEffect(() => {
        try { localStorage.setItem(GEOM_KEY, JSON.stringify(geom)); } catch { /* storage unavailable */ }
    }, [geom]);

    React.useEffect(() => {
        const onResize = () => setGeom(g => clampGeom(g));
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // Mirror the emulated OLED and the status line
    React.useEffect(() => {
        if (!open) return;
        let raf = 0;
        let rev = -1;
        const loop = () => {
            raf = requestAnimationFrame(loop);
            const c = canvasRef.current;
            if (c && rev !== robotUi.oled.revision) {
                rev = robotUi.oled.revision;
                const ctx = c.getContext('2d');
                if (ctx) { ctx.imageSmoothingEnabled = false; ctx.drawImage(robotUi.canvas, 0, 0); }
            }
            const s = robotUi.status;
            setStatus(prev => (prev === s ? prev : s));
        };
        loop();
        return () => cancelAnimationFrame(raf);
    }, [open]);

    if (!open) return null;

    const beginDrag = (kind: 'move' | 'resize') => (e: React.PointerEvent) => {
        if (kind === 'move' && (e.target as HTMLElement).closest('button')) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { kind, px: e.clientX, py: e.clientY, g: geom };
    };
    const onDrag = (e: React.PointerEvent) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.px, dy = e.clientY - d.py;
        setGeom(clampGeom(d.kind === 'move' ? { ...d.g, x: d.g.x + dx, y: d.g.y + dy } : { ...d.g, w: d.g.w + dx }));
    };
    const endDrag = () => { drag.current = null; };

    const onKeyDown = (e: React.KeyboardEvent) => {
        const b = KEYS[e.key];
        if (!b || e.repeat) return;
        if ((e.target as HTMLElement).tagName === 'BUTTON' && e.key === 'Enter') return; // Enter activates the focused switch
        e.preventDefault();
        robotUi.press(b);
    };
    const onKeyUp = (e: React.KeyboardEvent) => {
        const b = KEYS[e.key];
        if (b) robotUi.release(b);
    };

    const dis = !robotPower;
    const versionLabel = LIB_VERSIONS.find(v => v.id === version)?.label;
    const btn = Math.round(Math.max(30, Math.min(46, geom.w * 0.11)));
    const compact = geom.w < 300;

    return (
        <div
            role="dialog"
            aria-label={t('rp.title')}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            style={{ left: geom.x, top: geom.y, width: geom.w }}
            className="fixed z-40 rounded-lg border border-slate-300 bg-white/95 backdrop-blur shadow-xl text-left outline-none"
        >
            <div
                onPointerDown={beginDrag('move')}
                onPointerMove={onDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                title={t('rp.drag')}
                className="flex items-center justify-between gap-2 pl-2 pr-1.5 py-1.5 border-b border-slate-200 cursor-move touch-none select-none rounded-t-lg bg-slate-50"
            >
                <div className="flex items-center gap-1.5 min-w-0">
                    <GripHorizontal className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 leading-tight truncate">{t('rp.title')}</div>
                        {!compact && <div className="text-[11px] text-slate-500 truncate">{versionLabel} · {t('rp.keys')}</div>}
                    </div>
                </div>
                <button onClick={() => setOpen(false)} className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 flex-shrink-0" aria-label={t('rp.close')}>
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 px-2.5 py-2.5">
                <div className="flex flex-col gap-1.5">
                    <Latch label="POWER" on={robotPower} onToggle={() => setRobotPower(!robotPower)} size={btn} />
                    <Tactile btn="up" label="UP" disabled={dis} size={btn} />
                    <Tactile btn="down" label="DOWN" disabled={dis} size={btn} />
                </div>
                <div className="rounded-md bg-slate-900 p-1 border-[3px] border-[#1e3a8a]">
                    <canvas
                        ref={canvasRef}
                        width={128}
                        height={64}
                        className="block w-full aspect-[2/1] [image-rendering:pixelated]"
                        aria-label={t('rp.oled')}
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Latch label="MOTOR" on={motorPower} onToggle={() => setMotorPower(!motorPower)} size={btn} />
                    <Tactile btn="ok" label="OK" disabled={dis} size={btn} />
                    <Tactile btn="back" label="BACK" disabled={dis} size={btn} />
                </div>
            </div>
            {!compact && <p className="px-3 pb-2.5 pr-6 text-xs text-slate-600 min-h-[2rem]" aria-live="polite">{status}</p>}
            <div
                onPointerDown={beginDrag('resize')}
                onPointerMove={onDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                title={t('rp.resize')}
                aria-label={t('rp.resize')}
                role="separator"
                className="absolute right-0 bottom-0 w-5 h-5 cursor-nwse-resize touch-none"
            >
                <svg viewBox="0 0 10 10" className="w-full h-full text-slate-400" aria-hidden="true">
                    <path d="M9 3 L3 9 M9 6 L6 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
            </div>
        </div>
    );
};

export default RobotPanel;
