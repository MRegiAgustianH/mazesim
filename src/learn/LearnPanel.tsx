import React from 'react';
import { ChevronLeft, ChevronRight, Cpu, Lightbulb, Route, BookOpen, Play } from 'lucide-react';
import { useStore } from '../store/useStore';
import { PART_ORDER, type PartId } from '../simulator/robotLayout';
import { getLessons, getLibrary, getPart } from './localized';
import { useT } from '../i18n/i18n';
import { RobotDiagram } from './RobotDiagram';
import { LessonTrack } from './LessonTrack';
import { Note, CodeSample } from './ui';

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

// Rows that open the function in the Library tab
const FunctionList: React.FC<{ names: string[] }> = ({ names }) => {
    const openLibrary = useStore(s => s.openLibrary);
    const lang = useStore(s => s.lang);
    const summaries = React.useMemo(() => Object.fromEntries(getLibrary(lang).map(f => [f.name, f.summary])), [lang]);
    if (!names.length) return null;
    return (
        <ul className="rounded-md border border-slate-200 divide-y divide-slate-100">
            {names.map(n => (
                <li key={n}>
                    <button
                        onClick={() => openLibrary(n)}
                        className="group w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                    >
                        <code className="w-32 flex-shrink-0 text-xs font-mono font-semibold text-slate-900">{n}()</code>
                        <span className="flex-1 min-w-0 text-xs text-slate-600 leading-relaxed">{summaries[n]}</span>
                        <ChevronRight className="w-4 h-4 flex-shrink-0 text-slate-300 group-hover:text-slate-500" />
                    </button>
                </li>
            ))}
        </ul>
    );
};

// "Sense: the sensors…" -> the lead word in bold
const Paragraph: React.FC<{ text: string }> = ({ text }) => {
    const m = text.match(/^([^:.()]{2,24}):\s(.*)$/);
    return <p>{m ? <><span className="font-semibold text-slate-900">{m[1]}:</span> {m[2]}</> : text}</p>;
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
                    <FunctionList names={p.functions} />
                </div>
            )}
            {p.tip && (
                <Note icon={Lightbulb} title={t('learn.tip')}>{p.tip}</Note>
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
                    <LessonTrack titles={LESSONS.map(l => l.title)} current={lessonIdx} onSelect={goLesson} />

                    <header className="pt-1">
                        <div className={labelCls}>{t('learn.lessonOf', { n: lessonIdx + 1, total: LESSONS.length })}</div>
                        <h3 className="text-xl font-semibold text-slate-900 mt-1 text-balance">{lesson.title}</h3>
                        <p className="mt-2 text-[15px] text-slate-600 leading-relaxed text-pretty">{lesson.hook}</p>
                    </header>

                    <div className="space-y-2.5 text-sm text-slate-700 leading-relaxed max-w-prose">
                        {lesson.body.map((b, i) => <Paragraph key={i} text={b} />)}
                    </div>

                    {lesson.code && <CodeSample code={lesson.code} />}

                    {lesson.tryIt && <Note icon={Play} title={t('learn.tryIt')}>{lesson.tryIt}</Note>}

                    {lesson.functions.length > 0 && (
                        <section>
                            <h4 className={`${labelCls} mb-1.5`}>{t('learn.functions')}</h4>
                            <FunctionList names={lesson.functions} />
                        </section>
                    )}

                    <section>
                        <h4 className={`${labelCls} mb-1.5`}>{t('learn.partsInLesson')}</h4>
                        <ul className="rounded-md border border-slate-200 divide-y divide-slate-100">
                            {lesson.parts.map(id => {
                                const part = getPart(id, lang);
                                return (
                                    <li key={id}>
                                        <button
                                            onClick={() => selectPart(id)}
                                            className="group w-full flex items-start gap-3 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                                        >
                                            <span className="w-32 flex-shrink-0 text-xs font-semibold text-slate-900">{part.name}</span>
                                            <span className="flex-1 min-w-0 text-xs text-slate-600 leading-relaxed">{part.role}</span>
                                            <ChevronRight className="w-4 h-4 flex-shrink-0 text-slate-300 group-hover:text-slate-500" />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </section>

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
                                        ? 'border-slate-800 bg-slate-800 text-white'
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
