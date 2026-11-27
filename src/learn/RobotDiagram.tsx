import React from 'react';
import { Robot } from '../simulator/Robot';
import { BAR_WIDTH, LAYOUT, LAYOUT_BOUNDS, PART_COLORS as C, sensorBoardShape, type PartId, type Pt, type Rect } from '../simulator/robotLayout';
import { getPart } from './localized';
import { useStore } from '../store/useStore';
import { useT } from '../i18n/i18n';

// Clickable top view of the robot built from the same LAYOUT as the 2D/3D
// simulator. Front points up: svg x = s (right), svg y = -f (forward is up).

const probe = new Robot(0, 0, 0, 1); // 1 px per cm -> sensor positions in cm
const SENSORS = Array.from({ length: 8 }, (_, i) => {
    const p = probe.getSensorLocalPosition(i);
    return { f: p.forwardX, s: p.rightY };
});
const SB = sensorBoardShape(SENSORS);

const PAD = 0.6;
const VB = {
    x: LAYOUT_BOUNDS.s0 - PAD,
    y: -LAYOUT_BOUNDS.f1 - PAD,
    w: LAYOUT_BOUNDS.s1 - LAYOUT_BOUNDS.s0 + PAD * 2,
    h: LAYOUT_BOUNDS.f1 - LAYOUT_BOUNDS.f0 + PAD * 2,
};

const pts = (p: Pt[]) => p.map(([f, s]) => `${s},${-f}`).join(' ');
const grow = (r: Rect, d: number): Rect => ({ f0: r.f0 - d, f1: r.f1 + d, s0: r.s0 - d, s1: r.s1 + d });
const sq = (f: number, s: number, h: number): Rect => ({ f0: f - h, f1: f + h, s0: s - h, s1: s + h });

const R = ({ box: r, fill, rx = 0, ...rest }: { box: Rect; fill: string; rx?: number } & React.SVGProps<SVGRectElement>) => (
    <rect x={r.s0} y={-r.f1} width={r.s1 - r.s0} height={r.f1 - r.f0} rx={rx} fill={fill} {...rest} />
);
const Ring = ({ box, rx = 0.3 }: { box: Rect; rx?: number }) => <R box={grow(box, 0.2)} fill="none" rx={rx} className="part-ring" />;

interface Props {
    selected: PartId | null;
    emphasis?: PartId[]; // parts of the current lesson (soft highlight)
    onSelect: (part: PartId) => void;
    className?: string;
}

export const RobotDiagram: React.FC<Props> = ({ selected, emphasis = [], onSelect, className }) => {
    const [hover, setHover] = React.useState<PartId | null>(null);
    const lang = useStore(s => s.lang);
    const t = useT();
    const L = LAYOUT;

    const state = (id: PartId) => (id === selected ? 'sel' : id === hover ? 'hover' : emphasis.includes(id) ? 'em' : '');
    const part = (id: PartId, children: React.ReactNode) => (
        <g
            key={id}
            data-state={state(id)}
            className="robot-part cursor-pointer outline-none"
            onClick={() => onSelect(id)}
            onMouseEnter={() => setHover(id)}
            onMouseLeave={() => setHover(h => (h === id ? null : h))}
            onFocus={() => setHover(id)}
            onBlur={() => setHover(h => (h === id ? null : h))}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(id); } }}
            tabIndex={0}
            role="button"
            aria-label={getPart(id, lang).name}
            aria-pressed={id === selected}
        >
            {children}
        </g>
    );

    const { radius: WR, width: WW, s: WS } = L.wheel;
    const barPts = pts(SB.bar);
    const label = hover ?? selected;

    return (
        <div className={`relative flex flex-col ${className ?? ''}`}>
            <style>{`
                .robot-part[data-state="sel"] .part-ring { stroke: ${C.highlight}; stroke-width: .3; opacity: 1; }
                .robot-part[data-state="em"] .part-ring { stroke: ${C.highlight}; stroke-width: .18; stroke-dasharray: .5 .35; opacity: .9; }
                .robot-part[data-state="hover"] .part-ring { stroke: #2563eb; stroke-width: .22; opacity: 1; }
                .robot-part .part-ring { fill: none; opacity: 0; pointer-events: none; }
                .robot-part:focus-visible .part-ring { stroke: #2563eb; stroke-width: .25; opacity: 1; }
                .robot-part .part-ring.band { stroke-width: ${BAR_WIDTH + 0.6}; stroke-dasharray: none; }
                .robot-part:not([data-state=""]) .part-ring.band { opacity: .35; }
                /* Blink in step with the simulator's pulsing highlight (~1.1 s) */
                @keyframes part-blink { 0%, 100% { opacity: 1; } 50% { opacity: .15; } }
                @keyframes part-blink-band { 0%, 100% { opacity: .4; } 50% { opacity: .05; } }
                .robot-part[data-state="sel"] .part-ring,
                .robot-part[data-state="em"] .part-ring { animation: part-blink 1.13s ease-in-out infinite; }
                .robot-part[data-state="sel"] .part-ring.band,
                .robot-part[data-state="em"] .part-ring.band { animation-name: part-blink-band; }
                @media (prefers-reduced-motion: reduce) {
                    .robot-part .part-ring { animation: none !important; }
                }
            `}</style>
            <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="w-full flex-1 min-h-0" role="group" aria-label={t('learn.diagram')}>
                {/* Body first so everything else sits on top of it */}
                {part('chassis', <>
                    <polygon points={pts(L.board)} fill={C.board} stroke={C.boardEdge} strokeWidth={0.12} />
                    {L.screws.map(([f, s]) => <circle key={`${f}${s}`} cx={s} cy={-f} r={0.3} fill="#cbd5e1" />)}
                    <R box={L.boardHeader} fill="#111827" />
                    <polygon points={pts(L.board)} className="part-ring" strokeLinejoin="round" />
                </>)}

                {part('sensors', <>
                    <R box={SB.stem} fill={C.neck} rx={0.2} />
                    {SB.wings.map((w, i) => <polygon key={i} points={pts(w)} fill={C.sensorPcb} />)}
                    <polyline points={barPts} fill="none" stroke={C.sensorPcb} strokeWidth={BAR_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
                    <R box={SB.header} fill="#111827" />
                    <R box={{ f0: L.boardHeader.f1 - 0.1, f1: SB.header.f0 + 0.15, s0: -0.6, s1: 0.6 }} fill={C.ribbon} />
                    {SENSORS.map((p, i) => (
                        <g key={i}>
                            <circle cx={p.s} cy={-(p.f + 0.45)} r={0.3} fill={C.emitter} />
                            <circle cx={p.s} cy={-(p.f - 0.3)} r={0.26} fill="#334155" />
                            <text x={p.s} y={-(p.f + 1.3)} fontSize={0.6} textAnchor="middle" fill="#475569" fontWeight={600}>{i + 1}</text>
                        </g>
                    ))}
                    <polyline points={barPts} className="part-ring band" strokeLinecap="round" strokeLinejoin="round" />
                </>)}

                {part('mux', <>
                    <R box={SB.mux} fill={C.chip} />
                    <Ring box={SB.mux} />
                </>)}

                {part('caster', <>
                    {SB.holes.map(([f, s], i) => (
                        <g key={i}>
                            <circle cx={s} cy={-f} r={0.32} fill="#d4a017" />
                            <circle cx={s} cy={-f} r={0.16} fill="#0f172a" />
                            <circle cx={s} cy={-f} r={0.7} className="part-ring" />
                        </g>
                    ))}
                </>)}

                {part('wheels', <>
                    {[-1, 1].map(side => {
                        const r: Rect = { f0: -WR, f1: WR, s0: side * WS - WW / 2, s1: side * WS + WW / 2 };
                        return (
                            <g key={side}>
                                <R box={r} fill={C.tire} rx={0.35} stroke="#94a3b8" strokeWidth={0.08} />
                                <Ring box={r} rx={0.5} />
                            </g>
                        );
                    })}
                </>)}

                {part('motors', <>
                    {([[L.motorL, -1], [L.motorR, 1]] as const).map(([r, side]) => {
                        const g = L.gearboxLen;
                        const gb: Rect = side === 1 ? { ...r, s0: r.s1 - g } : { ...r, s1: r.s0 + g };
                        return (
                            <g key={side}>
                                <R box={side === 1 ? { ...r, s1: r.s1 - g } : { ...r, s0: r.s0 + g }} fill={C.motorCan} rx={0.6} />
                                <R box={gb} fill={C.gearbox} rx={0.15} />
                                {[1, 2, 3, 4].map(i => {
                                    const x = gb.s0 + (i * (gb.s1 - gb.s0)) / 5;
                                    return <line key={i} x1={x} x2={x} y1={-gb.f1} y2={-gb.f0} stroke="#6b7280" strokeWidth={0.08} />;
                                })}
                                <Ring box={r} rx={0.5} />
                            </g>
                        );
                    })}
                </>)}

                {part('battery', <>
                    <R box={L.battery} fill={C.batt} rx={0.25} />
                    <R box={L.battery} fill="none" rx={0.2} stroke={C.battEdge} strokeWidth={0.1} />
                    <text x={0} y={-(L.battery.f0 + L.battery.f1) / 2 + 0.25} fontSize={0.7} textAnchor="middle" fill="#713f12" fontWeight={700}>3S</text>
                    <Ring box={L.battery} rx={0.4} />
                </>)}

                {part('oled', <>
                    <R box={L.oled} fill="#1e3a8a" rx={0.15} />
                    <R box={L.oledScreen} fill={C.oled} />
                    {[0, 1, 2].map(i => <rect key={i} x={L.oledScreen.s0 + 0.35} y={-(L.oledScreen.f0 + 0.47 + i * 0.35)} width={1.0} height={0.12} fill="#7dd3fc" />)}
                    <Ring box={L.oled} />
                </>)}

                {part('driver', <>
                    <R box={L.driver} fill={C.driver} />
                    <Ring box={L.driver} />
                </>)}

                {part('buttons', <>
                    {L.buttons.map(b => (
                        <g key={b.label}>
                            <R box={sq(b.f, b.s, 0.45)} fill="#1f2937" />
                            <circle cx={b.s} cy={-b.f} r={0.27} fill={C.button} />
                            <Ring box={sq(b.f, b.s, 0.45)} rx={0.25} />
                        </g>
                    ))}
                </>)}

                {part('switch', <>
                    {L.switches.map((sw, i) => (
                        <g key={i}>
                            <R box={sq(sw.f, sw.s, 0.55)} fill="#334155" rx={0.12} />
                            <R box={sq(sw.f, sw.s, 0.4)} fill={C.switch} rx={0.08} />
                            <Ring box={sq(sw.f, sw.s, 0.55)} />
                        </g>
                    ))}
                </>)}

                {part('nano', <>
                    <R box={{ ...L.nano, f0: L.nano.f0 - 0.05, f1: L.nano.f1 + 0.05 }} fill="#111827" />
                    <R box={L.nano} fill={C.nano} rx={0.1} />
                    <rect x={-0.45} y={-3.35} width={0.9} height={0.9} fill={C.chip} transform="rotate(45 0 -2.9)" />
                    <R box={{ f0: L.nano.f0 + 0.55, f1: L.nano.f1 - 0.55, s0: L.nano.s1 - 0.6, s1: L.nano.s1 + 0.15 }} fill={C.usb} />
                    {Array.from({ length: 15 }, (_, i) => {
                        const s = L.nano.s0 + 0.2 + i * ((L.nano.s1 - L.nano.s0 - 0.4) / 14);
                        return <g key={i} fill="#fbbf24"><rect x={s - 0.06} y={-(L.nano.f0 + 0.22)} width={0.12} height={0.12} /><rect x={s - 0.06} y={-(L.nano.f1 - 0.1)} width={0.12} height={0.12} /></g>;
                    })}
                    <text x={-1.95} y={-2.3} fontSize={0.42} fill="#dbeafe" fontWeight={700}>NANO</text>
                    <Ring box={{ ...L.nano, s1: L.nano.s1 + 0.15 }} />
                </>)}
            </svg>
            <div className="absolute top-1 left-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 pointer-events-none">{t('learn.front')}</div>
            <div className="mt-1 text-center pointer-events-none">
                <span className="inline-block text-[11px] font-medium text-slate-700 bg-white/90 border border-slate-200 rounded px-2 py-0.5 min-h-[22px]">
                    {label ? getPart(label, lang).name : t('learn.clickPart')}
                </span>
            </div>
        </div>
    );
};
