import React from 'react';
import { useT } from '../i18n/i18n';
import type { Robot } from './Robot';

// Live digital sensor readout (sensor 1 = left … 8 = right), shown in the
// simulator's top-right corner in both 2D and 3D. Updates the DOM directly
// each frame instead of re-rendering React.

export const SensorStrip: React.FC<{ getRobot: () => Robot | null }> = ({ getRobot }) => {
    const t = useT();
    const cells = React.useRef<(HTMLSpanElement | null)[]>([]);
    const bits = React.useRef<HTMLSpanElement>(null);

    React.useEffect(() => {
        let raf = 0;
        let last = '';
        const loop = () => {
            raf = requestAnimationFrame(loop);
            const s = getRobot()?.sensors ?? [];
            const key = s.join('');
            if (key === last) return;
            last = key;
            cells.current.forEach((el, i) => {
                if (el) el.dataset.on = s[i] === 1 ? '1' : '0';
            });
            if (bits.current) bits.current.textContent = key || '--------';
        };
        loop();
        return () => cancelAnimationFrame(raf);
    }, [getRobot]);

    return (
        <div
            className="rounded-md border border-slate-300 bg-white/95 shadow-sm px-2 py-1.5 select-none"
            title={t('sim.sensorsHint')}
            role="status"
            aria-label={t('sim.sensors')}
        >
            <div className="flex items-center justify-between gap-3 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t('sim.sensors')}</span>
                <span ref={bits} className="font-mono text-[11px] text-slate-700 tabular-nums">--------</span>
            </div>
            <div className="flex gap-1">
                {Array.from({ length: 8 }, (_, i) => (
                    <span
                        key={i}
                        ref={el => { cells.current[i] = el; }}
                        data-on="0"
                        className="w-5 h-6 rounded-sm border flex items-end justify-center pb-0.5 text-[9px] font-semibold transition-colors
                            data-[on=0]:bg-slate-100 data-[on=0]:border-slate-300 data-[on=0]:text-slate-500
                            data-[on=1]:bg-red-500 data-[on=1]:border-red-600 data-[on=1]:text-white"
                    >
                        {i + 1}
                    </span>
                ))}
            </div>
        </div>
    );
};

export default SensorStrip;
