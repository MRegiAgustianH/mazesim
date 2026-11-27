import { useT } from '../i18n/i18n';

// Lesson progress drawn as a line-follower track: START, one junction per
// lesson, FINISH, and a robot that drives to the current lesson.

const BOARD = '#1b7fb8';
const NECK = '#2aa7e0';

// Top view, facing right (sensor bar in front)
function MiniRobot() {
    return (
        <svg viewBox="0 0 40 30" className="w-10 h-[30px] drop-shadow" aria-hidden>
            <rect x="2" y="1" width="12" height="6" rx="2" fill="#1f2937" />
            <rect x="2" y="23" width="12" height="6" rx="2" fill="#1f2937" />
            <rect x="0" y="6" width="18" height="18" rx="3" fill={BOARD} />
            <rect x="5" y="11" width="7" height="8" rx="1" fill="#facc15" />
            <rect x="17" y="13" width="12" height="4" fill={NECK} />
            <path d="M33 3 Q38 15 33 27" fill="none" stroke={BOARD} strokeWidth="5" strokeLinecap="round" />
            {[6, 10, 14, 16, 20, 24].map((y, i) => (
                <circle key={i} cx={y < 9 || y > 21 ? 34.2 : 35.6} cy={y} r="1.1" fill="#ef4444" className="lesson-sensor" />
            ))}
        </svg>
    );
}

export function LessonTrack({ titles, current, onSelect }: { titles: string[]; current: number; onSelect: (i: number) => void }) {
    const t = useT();
    const n = titles.length;

    return (
        <div className="overflow-x-auto -mx-1 px-1 pb-1">
            <style>{`
                @keyframes lesson-sensor { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
                .lesson-sensor { animation: lesson-sensor .9s ease-in-out infinite; }
                @media (prefers-reduced-motion: reduce) { .lesson-sensor { animation: none; } }
            `}</style>
            <div className="relative h-[84px] min-w-[360px] rounded-md bg-[#f8f7f2] border border-slate-200">
                {/* Line, and the part already driven */}
                <div className="absolute left-5 right-5 top-[34px] h-1.5 -translate-y-1/2 rounded-full bg-slate-800" />
                <div
                    className="absolute left-5 top-[34px] h-1.5 -translate-y-1/2 rounded-full bg-blue-500 transition-[width] duration-700 ease-in-out motion-reduce:transition-none"
                    style={{ width: `calc((100% - 2.5rem) * ${(current + 1) / (n + 1)})` }}
                />

                {/* START strip */}
                <div className="absolute left-5 top-[34px] -translate-x-1/2 -translate-y-1/2 w-1.5 h-7 rounded-sm bg-emerald-500" aria-hidden />
                <span className="absolute left-1.5 top-[56px] text-[9px] font-bold tracking-wider text-emerald-700">START</span>

                {/* FINISH checker */}
                <div
                    className="absolute right-5 top-[34px] translate-x-1/2 -translate-y-1/2 w-3 h-7 rounded-sm border border-slate-800"
                    style={{ backgroundImage: 'repeating-conic-gradient(#1e293b 0 25%, #fff 0 50%)', backgroundSize: '6px 6px' }}
                    aria-hidden
                />
                <span className="absolute right-1 top-[56px] text-[9px] font-bold tracking-wider text-slate-700">FINISH</span>

                {/* Junctions = lessons. The track is inset by 1.25rem on each side. */}
                <ol aria-label={t('learn.lessons')}>
                    {titles.map((title, i) => {
                        const left = `calc(1.25rem + (100% - 2.5rem) * ${(i + 1) / (n + 1)})`;
                        const done = i < current;
                        const here = i === current;
                        return (
                            <li key={i} className="absolute top-0 bottom-0 -translate-x-1/2" style={{ left }}>
                                <span
                                    aria-hidden
                                    className={`absolute left-1/2 top-[34px] -translate-x-1/2 -translate-y-1/2 w-1 h-5 rounded-full ${done || here ? 'bg-blue-500' : 'bg-slate-800'}`}
                                />
                                <button
                                    onClick={() => onSelect(i)}
                                    title={title}
                                    aria-label={`${i + 1}. ${title}`}
                                    aria-current={here ? 'step' : undefined}
                                    className={`absolute left-1/2 top-[52px] -translate-x-1/2 w-6 h-6 rounded-full text-[11px] font-semibold border transition-colors ${
                                        here
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : done
                                                ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                                                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    {i + 1}
                                </button>
                            </li>
                        );
                    })}
                </ol>

                {/* Robot riding on the line, sensors on the current junction */}
                <div
                    className="absolute top-[34px] -translate-x-[85%] -translate-y-1/2 pointer-events-none transition-[left] duration-700 ease-in-out motion-reduce:transition-none"
                    style={{ left: `calc(1.25rem + (100% - 2.5rem) * ${(current + 1) / (n + 1)})` }}
                >
                    <MiniRobot />
                </div>
            </div>
        </div>
    );
}
