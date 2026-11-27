import React from 'react';
import { ChevronDown, Info, Puzzle, Search } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { PartId } from '../simulator/robotLayout';
import { getCategories, getLibrary, getPart } from './localized';
import type { CategoryId, LibFunction } from './libraryDocs';
import { useT } from '../i18n/i18n';
import { Note, CodeSample } from './ui';

const labelCls = 'text-[11px] font-semibold uppercase tracking-wide text-slate-500';

const FunctionCard: React.FC<{ fn: LibFunction; open: boolean; onToggle: () => void; cardRef?: React.Ref<HTMLDivElement> }> = ({ fn, open, onToggle, cardRef }) => {
    const setEditorMode = useStore(s => s.setEditorMode);
    const setHighlightPart = useStore(s => s.setHighlightPart);
    const lang = useStore(s => s.lang);
    const t = useT();
    const showPart = (id: PartId) => { setHighlightPart(id); setEditorMode('learn'); };

    return (
        <div ref={cardRef} className={`rounded-lg border transition-colors ${open ? 'border-slate-300 bg-white shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
            <button onClick={onToggle} className="w-full text-left px-3 py-2.5 flex items-start gap-2" aria-expanded={open}>
                <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm font-semibold text-slate-900">{fn.name}()</div>
                    <div className="text-xs text-slate-600 mt-0.5">{fn.summary}</div>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="px-3 pb-3 space-y-3 border-t border-slate-100 pt-3">
                    <code className="block text-xs font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 break-words">
                        {fn.signature}
                    </code>

                    {fn.params.length > 0 && (
                        <div>
                            <div className={`${labelCls} mb-1`}>{t('lib.params')}</div>
                            <table className="w-full text-xs">
                                <tbody>
                                    {fn.params.map(p => (
                                        <tr key={p.name} className="border-t border-slate-100 first:border-t-0 align-top">
                                            <td className="py-1.5 pr-3 font-mono text-slate-900 whitespace-nowrap">{p.name}</td>
                                            <td className="py-1.5 pr-3 text-slate-500 whitespace-nowrap">{p.range ?? p.type}</td>
                                            <td className="py-1.5 text-slate-700">{p.desc}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div>
                        <div className={`${labelCls} mb-1`}>{t('lib.how')}</div>
                        <div className="space-y-1.5 text-xs text-slate-700 leading-relaxed">
                            {fn.details.map((d, i) => <p key={i}>{d}</p>)}
                        </div>
                    </div>

                    <div>
                        <div className={`${labelCls} mb-1`}>{t('lib.example')}</div>
                        <CodeSample code={fn.example} copy />
                    </div>

                    {fn.sim && (
                        <Note icon={Info} title={t('lib.inSim')}>{fn.sim}</Note>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                        {fn.block && (
                            <span className="inline-flex items-center gap-1 text-slate-600">
                                <Puzzle className="w-3.5 h-3.5 text-slate-400" />
                                {t('lib.block')} <span className="font-medium text-slate-800">{fn.block}</span>
                            </span>
                        )}
                        {fn.parts.length > 0 && (
                            <span className="inline-flex flex-wrap items-center gap-1">
                                <span className="text-slate-500">{t('lib.hardware')}</span>
                                {fn.parts.map((id, i) => (
                                    <React.Fragment key={id}>
                                        {i > 0 && <span className="text-slate-300" aria-hidden>·</span>}
                                        <button
                                            onClick={() => showPart(id)}
                                            className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-600 transition-colors"
                                        >
                                            {getPart(id, lang).name}
                                        </button>
                                    </React.Fragment>
                                ))}
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export const LibraryPanel: React.FC = () => {
    const libraryFocus = useStore(s => s.libraryFocus);
    const editorMode = useStore(s => s.editorMode);
    const lang = useStore(s => s.lang);
    const t = useT();
    const LIBRARY = React.useMemo(() => getLibrary(lang), [lang]);
    const CATEGORIES = React.useMemo(() => getCategories(lang), [lang]);
    const [query, setQuery] = React.useState('');
    const [category, setCategory] = React.useState<CategoryId | 'all'>('all');
    const [openSet, setOpenSet] = React.useState<Set<string>>(() => new Set());
    const cardRefs = React.useRef(new Map<string, HTMLDivElement>());

    // Jump to a function requested from the Learn tab
    React.useEffect(() => {
        if (!libraryFocus || editorMode !== 'library') return;
        setQuery('');
        setCategory('all');
        setOpenSet(s => new Set(s).add(libraryFocus));
        const name = libraryFocus;
        requestAnimationFrame(() => cardRefs.current.get(name)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
        useStore.setState({ libraryFocus: null });
    }, [libraryFocus, editorMode]);

    const q = query.trim().toLowerCase();
    const matches = LIBRARY.filter(f =>
        (category === 'all' || f.category === category) &&
        (!q || f.name.toLowerCase().includes(q) || f.summary.toLowerCase().includes(q) || (f.block ?? '').toLowerCase().includes(q)),
    );

    const toggle = (name: string) => setOpenSet(s => {
        const n = new Set(s);
        if (n.has(name)) n.delete(name); else n.add(name);
        return n;
    });

    const catBtn = (id: CategoryId | 'all', label: string) => (
        <button
            key={id}
            onClick={() => setCategory(id)}
            aria-pressed={category === id}
            className={`px-2.5 h-7 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                category === id ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
        >
            {label}
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-white text-slate-800 text-left">
            <div className="px-4 pt-3 pb-3 border-b border-slate-200 space-y-3">
                <div>
                    <h2 className="text-base font-semibold text-slate-900">{t('lib.title')}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {t('lib.subtitle')}
                    </p>
                </div>
                <label className="relative block">
                    <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="search"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={t('lib.search')}
                        className="w-full h-9 pl-8 pr-3 rounded-md border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        aria-label={t('lib.searchLabel')}
                    />
                </label>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
                    {catBtn('all', t('lib.all'))}
                    {CATEGORIES.map(c => catBtn(c.id, c.label))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
                {CATEGORIES.map(cat => {
                    const fns = matches.filter(f => f.category === cat.id);
                    if (!fns.length) return null;
                    return (
                        <section key={cat.id}>
                            <div className="mb-2">
                                <h3 className="text-sm font-semibold text-slate-800">{cat.label}</h3>
                                <p className="text-xs text-slate-500">{cat.desc}</p>
                            </div>
                            <div className="space-y-2">
                                {fns.map(fn => (
                                    <FunctionCard
                                        key={fn.name}
                                        fn={fn}
                                        open={openSet.has(fn.name)}
                                        onToggle={() => toggle(fn.name)}
                                        cardRef={el => { if (el) cardRefs.current.set(fn.name, el); else cardRefs.current.delete(fn.name); }}
                                    />
                                ))}
                            </div>
                        </section>
                    );
                })}
                {matches.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-8">{t('lib.noMatch', { q: query })}</p>
                )}
            </div>
        </div>
    );
};

export default LibraryPanel;
