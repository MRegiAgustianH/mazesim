import React from 'react';
import { ChevronLeft, ChevronRight, Cpu, Lightbulb, Route, BookOpen } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PART_ORDER, type PartId } from '../simulator/robotLayout';
import { getLessons, getLibrary, getPart } from './localized';
import { useT } from '../i18n/i18n';
import { RobotDiagram } from './RobotDiagram';

type View = 'path' | 'parts';

const LESSON_KEY = 'learn_lesson_index';
const LESSON_COUNT = getLessons('en').length;
const readLesson = () => {
    try {
        const n = Number(localStorage.getItem(LESSON_KEY));
        return Number.isInteger(n) && n >= 0 && n < LESSON_COUNT ? n : 0;
    } catch { return 0; }
};

const labelCls = 'text-[11px] font-semibold uppercase tracking-wide text-slate-500';
const btnBase = 'inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors disabled:cursor-not-allowed';
const btnSecondary = `${btnBase} bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-300 disabled:bg-white`;
const btnPrimary = `${btnBase} bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400`;

const FunctionChips: React.FC<{ names: string[] }> = ({ names }) => {
    const openLibrary = useStore(s => s.openLibrary);
    const lang = useStore(s => s.lang);
    const summaries = React.useMemo(() => Object.fromEntries(getLibrary(lang).map(f => [f.name, f.summary])), [lang]);
    if (!names.length) return null;
    return (
        <div className="flex flex-wrap gap-1.5">
            {names.map(n => (
                <button
                    key={n}
                    onClick={() => openLibrary(n)}
                    title={summaries[n]}
                    className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-[11px] font-mono text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors"
                >
                    {n}()
                </button>
            ))}
        </div>
    );
};

const PartDetail: React.FC<{ id: PartId }> = ({ id }) => {
    const lang = useStore(s => s.lang);
    const t = useT();
    const p = getPart(id, lang);
    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-base font-semibold text-slate-900">{p.name}</h3>
                <p className="text-sm text-slate-600 mt-0.5">{p.role}</p>
            </div>
            <div className="space-y-2 text-sm text-slate-700 leading-relaxed">
                {p.description.map((d, i) => <p key={i}>{d}</p>)}
            </div>
            <div>
                <div className={`${labelCls} mb-1.5`}>{t('learn.specs')}</div>
                <dl className="grid grid-cols-[minmax(0,auto)_1fr] gap-x-4 gap-y-1 text-xs">
                    {p.specs.map(([k, v]) => (
                        <React.Fragment key={k}>
                            <dt className="text-slate-500">{k}</dt>
                            <dd className="text-slate-800">{v}</dd>
                        </React.Fragment>
                    ))}
                </dl>
            </div>
            {p.pins && (
                <div>
                    <div className={`${labelCls} mb-1.5`}>{t('learn.pins')}</div>
                    <table className="w-full text-xs">
                        <tbody>
                            {p.pins.map(pin => (
                                <tr key={pin.pin} className="border-t border-slate-100 first:border-t-0">
                                    <td className="py-1 pr-3 font-mono text-slate-800 whitespace-nowrap align-top">{pin.pin}</td>
                                    <td className="py-1 text-slate-600">{pin.signal}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {p.functions.length > 0 && (
                <div>
                    <div className={`${labelCls} mb-1.5`}>{t('learn.libFns')}</div>
                    <FunctionChips names={p.functions} />
                </div>
            )}
            {p.tip && (
                <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <Lightbulb className="w-4 h-4 flex-shrink-0 mt-px" />
                    <span>{p.tip}</span>
                </div>
            )}
        </div>
    );
};

export const LearnPanel: React.FC = () => {
    const highlightPart = useStore(s => s.highlightPart);
    const setHighlightPart = useStore(s => s.setHighlightPart);
    const lang = useStore(s => s.lang);
    const t = useT();
    const LESSONS = React.useMemo(() => getLessons(lang), [lang]);
    const [view, setView] = React.useState<View>('path');
    const [lessonIdx, setLessonIdx] = React.useState(readLesson);
    const lesson = LESSONS[lessonIdx];
    const scrollRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        try { localStorage.setItem(LESSON_KEY, String(lessonIdx)); } catch { /* storage unavailable */ }
    }, [lessonIdx]);

    // In the path view the simulator highlights the lesson's main part
    React.useEffect(() => {
        if (view === 'path') setHighlightPart(lesson.parts[0] ?? null);
    }, [view, lesson.parts, setHighlightPart]);

    const goLesson = (i: number) => {
        setLessonIdx(i);
        scrollRef.current?.scrollTo({ top: 0 });
    };
    const selectPart = (id: PartId) => {
        setHighlightPart(id);
        setView('parts');
    };

    const tabBtn = (v: View, label: string, Icon: typeof Route) => (
        <button
            onClick={() => setView(v)}
            className={`flex items-center gap-1.5 px-3 h-7 text-xs font-medium transition-colors ${view === v ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            aria-pressed={view === v}
        >
            <Icon className="w-3.5 h-3.5" />
            {label}
        </button>
    );

    return (
        <div ref={scrollRef} className="flex flex-col h-full overflow-y-auto bg-white text-slate-800 text-left">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 className="text-base font-semibold text-slate-900">{t('learn.title')}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{t('learn.subtitle')}</p>
                </div>
                <div className="flex rounded-md border border-slate-300 overflow-hidden">
                    {tabBtn('path', t('learn.path'), Route)}
                    {tabBtn('parts', t('learn.parts'), Cpu)}
                </div>
            </div>

            <div className="px-4 py-4 border-b border-slate-200 bg-slate-50">
                <RobotDiagram
                    className="mx-auto h-64 w-full max-w-[400px]"
                    selected={view === 'parts' ? highlightPart : null}
                    emphasis={view === 'path' ? lesson.parts : []}
                    onSelect={selectPart}
                />
                <p className="text-[11px] text-slate-500 text-center mt-2">
                    {t('learn.caption')}
                </p>
            </div>

            {view === 'path' ? (
                <div className="px-4 py-4 space-y-4">
                    <ol className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1" aria-label={t('learn.lessons')}>
                        {LESSONS.map((l, i) => (
                            <li key={l.id}>
                                <button
                                    onClick={() => goLesson(i)}
                                    title={l.title}
                                    aria-current={i === lessonIdx ? 'step' : undefined}
                                    className={`w-7 h-7 rounded-full text-xs font-semibold border transition-colors ${
                                        i === lessonIdx
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : i < lessonIdx
                                                ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                                                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    {i + 1}
                                </button>
                            </li>
                        ))}
                    </ol>

                    <div>
                        <div className={labelCls}>{t('learn.lessonOf', { n: lessonIdx + 1, total: LESSONS.length })}</div>
                        <h3 className="text-lg font-semibold text-slate-900 mt-0.5">{lesson.title}</h3>
                    </div>

                    <div className="space-y-2.5 text-sm text-slate-700 leading-relaxed">
                        {lesson.body.map((b, i) => <p key={i}>{b}</p>)}
                    </div>

                    <div>
                        <div className={`${labelCls} mb-1.5`}>{t('learn.partsInLesson')}</div>
                        <div className="flex flex-wrap gap-1.5">
                            {lesson.parts.map(id => (
                                <button
                                    key={id}
                                    onClick={() => selectPart(id)}
                                    className="px-2 py-1 rounded border border-orange-200 bg-orange-50 text-[11px] font-medium text-orange-800 hover:bg-orange-100 transition-colors"
                                >
                                    {getPart(id, lang).name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {lesson.functions.length > 0 && (
                        <div>
                            <div className={`${labelCls} mb-1.5`}>{t('learn.functions')}</div>
                            <FunctionChips names={lesson.functions} />
                        </div>
                    )}

                    {lesson.tryIt && (
                        <div className="flex gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                            <Lightbulb className="w-4 h-4 flex-shrink-0 mt-px" />
                            <span><span className="font-semibold">{t('learn.tryIt')} </span>{lesson.tryIt}</span>
                        </div>
                    )}

                    <div className="flex justify-between pt-2">
                        <button className={btnSecondary} disabled={lessonIdx === 0} onClick={() => goLesson(lessonIdx - 1)}>
                            <ChevronLeft className="w-4 h-4" /> {t('learn.prev')}
                        </button>
                        {lessonIdx < LESSONS.length - 1 ? (
                            <button className={btnPrimary} onClick={() => goLesson(lessonIdx + 1)}>
                                {t('learn.next')} <ChevronRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button className={btnPrimary} onClick={() => useStore.getState().openLibrary(null)}>
                                <BookOpen className="w-4 h-4" /> {t('learn.openLibrary')}
                            </button>
                        )}
                    </div>
                </div>
            ) : (
                <div className="px-4 py-4 space-y-4">
                    <div className="flex flex-wrap gap-1.5" role="list" aria-label={t('learn.allParts')}>
                        {PART_ORDER.map(id => (
                            <button
                                key={id}
                                role="listitem"
                                onClick={() => setHighlightPart(id)}
                                aria-pressed={highlightPart === id}
                                className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
                                    highlightPart === id
                                        ? 'border-orange-400 bg-orange-50 text-orange-800'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {getPart(id, lang).name}
                            </button>
                        ))}
                    </div>
                    {highlightPart ? <PartDetail id={highlightPart} /> : <p className="text-sm text-slate-500">{t('learn.pickPart')}</p>}
                </div>
            )}
        </div>
    );
};

export default LearnPanel;
