import React from 'react';
import { FilePlus2, Blocks, CheckCircle2, AlertTriangle, Box, KeyRound } from 'lucide-react';
import { useStore } from '../store/useStore';
import { inoSketch, LIB_VERSIONS, type LibVersion } from '../blockly/inoTemplate';
import { getLibrary } from '../learn/localized';
import { libSuggestions, filterSuggestions, completionContext, callContext, type Suggestion } from './completions';
import { compileIno } from './inoTranspiler';
import { ConfirmDialog, type DialogSpec } from './ConfirmDialog';
import { useT } from '../i18n/i18n';

const sketchTemplate = (v: LibVersion) => inoSketch(v, '  my.motor(80,80,300);');

// Colours follow the Arduino IDE 2 light theme
const TOKEN_RE = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(^[ \t]*#[^\n]*)|(\b\d+(?:\.\d+)?\b)|(\b(?:void|int|long|short|float|double|bool|boolean|byte|char|word|unsigned|const|static|volatile|String|u?int(?:8|16|32|64)_t|if|else|for|while|do|switch|case|default|break|continue|return|true|false|HIGH|LOW)\b)|(\bmrbMaze\d+\b)|(\b(?:setup|loop|delay|millis|micros|Serial|constrain|map|abs|min|max|random)\b)|(\.\s*\w+(?=\s*\())/gm;
const COLORS = ['#95a5a6', '#005c5f', '#728e00', '#8a7b52', '#00979d', '#00979d', '#5e6d03', '#d35400'];

function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlight(code: string): string {
    let out = '';
    let last = 0;
    for (const m of code.matchAll(TOKEN_RE)) {
        const idx = m.index!;
        out += escapeHtml(code.slice(last, idx));
        const group = m.slice(1).findIndex(g => g !== undefined);
        const style = group === 4 || group === 5 ? 'font-weight:600;' : '';
        out += `<span style="color:${COLORS[group]};${style}">${escapeHtml(m[0])}</span>`;
        last = idx + m[0].length;
    }
    // trailing newline keeps the overlay as tall as the textarea
    return out + escapeHtml(code.slice(last)) + '\n';
}

export default function CodeEditor() {
    const t = useT();
    const code = useStore(s => s.sketchCode);
    const setCode = useStore(s => s.setSketchCode);
    const version = useStore(s => s.libraryVersion);
    const setLibraryVersion = useStore(s => s.setLibraryVersion);
    const blocklyIno = useStore(s => s.arduinoCode);
    const taRef = React.useRef<HTMLTextAreaElement>(null);
    const preRef = React.useRef<HTMLPreElement>(null);
    const gutterRef = React.useRef<HTMLDivElement>(null);
    const [error, setError] = React.useState<string | null>(null);

    // First visit: start from the same template as the generated .ino
    React.useEffect(() => {
        if (!code) setCode(sketchTemplate(version));
    }, [code, version, setCode]);

    React.useEffect(() => {
        const id = setTimeout(() => {
            try { compileIno(code); setError(null); } catch (e) { setError((e as Error).message); }
        }, 300);
        return () => clearTimeout(id);
    }, [code]);

    // Errors thrown while the sketch runs in the simulator
    React.useEffect(() => {
        const onErr = (e: Event) => setError((e as CustomEvent<string>).detail);
        window.addEventListener('sketch-error', onErr);
        return () => window.removeEventListener('sketch-error', onErr);
    }, []);

    const html = React.useMemo(() => highlight(code), [code]);
    const lines = React.useMemo(() => code.split('\n').length, [code]);

    // ---- Suggestions
    const lang = useStore(s => s.lang);
    const lib = React.useMemo(() => libSuggestions(getLibrary(lang), version), [lang, version]);
    const [caret, setCaret] = React.useState(0);
    const [acOpen, setAcOpen] = React.useState(false);
    const [acIndex, setAcIndex] = React.useState(0);
    const [scroll, setScroll] = React.useState({ top: 0, left: 0 });
    const [charW, setCharW] = React.useState(7.8);
    const measureRef = React.useRef<HTMLSpanElement>(null);
    const listRef = React.useRef<HTMLUListElement>(null);

    React.useLayoutEffect(() => {
        if (measureRef.current) setCharW(measureRef.current.getBoundingClientRect().width / 10);
    }, []);

    const before = code.slice(0, caret);
    const ctx = acOpen ? completionContext(before) : null;
    const matches = ctx ? filterSuggestions(ctx.member ? lib.my : lib.globals, ctx.prefix) : [];
    // nothing left to complete once the word is typed in full
    const items = matches.length === 1 && matches[0].label === ctx?.prefix ? [] : matches;
    const showList = items.length > 0;
    const active = Math.min(acIndex, items.length - 1);

    const call = !showList ? callContext(before) : null;
    const callFn = call && (call.member ? lib.my : lib.globals).find(s => s.label === call.name && s.params);

    // Caret position inside the editor area, for placing the popup
    const lineNo = before.split('\n').length - 1;
    const col = before.length - before.lastIndexOf('\n') - 1;
    const pos = { top: lineNo * 20 + 8 - scroll.top, left: col * charW + 8 - scroll.left };

    React.useEffect(() => {
        listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
    }, [active]);

    const updateCaret = () => { if (taRef.current) setCaret(taRef.current.selectionStart); };

    const syncScroll = () => {
        const ta = taRef.current;
        if (!ta) return;
        if (preRef.current) { preRef.current.scrollTop = ta.scrollTop; preRef.current.scrollLeft = ta.scrollLeft; }
        if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
        setScroll({ top: ta.scrollTop, left: ta.scrollLeft });
    };

    // Replace the selection and keep the browser's undo history
    const insert = (text: string) => document.execCommand('insertText', false, text);

    const accept = (s: Suggestion) => {
        const ta = taRef.current;
        if (!ta || !ctx) return;
        ta.focus();
        ta.selectionStart = ta.selectionStart - ctx.prefix.length;
        const after = ta.value.slice(ta.selectionEnd);
        if (s.kind === 'fn' && !after.startsWith('(')) {
            insert(`${s.label}()`);
            // caret between the parentheses when there are arguments to type
            if (s.params?.length) ta.selectionStart = ta.selectionEnd = ta.selectionStart - 1;
        } else {
            insert(s.label + (s.label === 'my' ? '.' : ''));
        }
        setAcOpen(s.label === 'my');
        setAcIndex(0);
        updateCaret();
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const ta = e.currentTarget;
        if (showList) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const n = items.length;
                setAcIndex((active + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); accept(items[active]); return; }
            if (e.key === 'Escape') { e.preventDefault(); setAcOpen(false); return; }
        }
        if (e.key === ' ' && e.ctrlKey) { e.preventDefault(); setAcOpen(true); setAcIndex(0); return; }
        if (e.key === 'Tab') {
            e.preventDefault();
            insert('  ');
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const before = ta.value.slice(0, ta.selectionStart);
            const indent = before.slice(before.lastIndexOf('\n') + 1).match(/^[ \t]*/)![0];
            insert('\n' + indent + (before.trimEnd().endsWith('{') ? '  ' : ''));
        } else if (e.key === '}') {
            const before = ta.value.slice(0, ta.selectionStart);
            const lineStart = before.slice(before.lastIndexOf('\n') + 1);
            if (/^ {2,}$/.test(lineStart)) {
                e.preventDefault();
                ta.selectionStart -= 2;
                insert('}');
            }
        }
    };

    const [dialog, setDialog] = React.useState<DialogSpec | null>(null);
    const closeDialog = React.useCallback(() => setDialog(null), []);

    // Replace the code, asking first if it holds the user's own edits
    const replaceCode = (next: string) => {
        if (code === sketchTemplate(version) || code === next) { setCode(next); return; }
        setDialog({
            title: t('code.replaceTitle'),
            message: t('code.confirmReplace'),
            actions: [
                { label: t('code.cancel'), onClick: () => { } },
                { label: t('code.replace'), primary: true, onClick: () => setCode(next) },
            ],
        });
    };


    return (
        <div className="flex flex-col w-full h-full bg-white">
            <div className="flex items-center justify-between gap-2 px-2 h-9 border-b border-slate-200 bg-slate-50 flex-shrink-0">
                <div className="flex items-center h-full">
                    <span className="px-3 h-full flex items-center text-xs font-mono text-slate-700 bg-white border-x border-t border-slate-200 border-t-[#00979d] border-t-2">
                        mrbMaze{version}_robot.ino
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="flex rounded border border-slate-300 overflow-hidden h-7 mr-1" role="group" aria-label={t('code.template')} title={t('code.templateTitle')}>
                        {LIB_VERSIONS.map(v => (
                            <button
                                key={v.id}
                                onClick={() => setLibraryVersion(v.id)}
                                aria-pressed={v.id === version}
                                className={`px-2 text-xs font-semibold transition-colors ${v.id === version ? 'bg-[#00979d] text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                            >
                                {v.label.replace('mrbMaze ', '')}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => replaceCode(sketchTemplate(version))}
                        className="flex items-center gap-1 px-2 h-7 rounded text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                        title={t('code.newTitle')}
                    >
                        <FilePlus2 className="w-3.5 h-3.5" />
                        <span>{t('code.new')}</span>
                    </button>
                    <button
                        onClick={() => { if (blocklyIno) replaceCode(blocklyIno); }}
                        disabled={!blocklyIno}
                        className="flex items-center gap-1 px-2 h-7 rounded text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-40 transition-colors"
                        title={t('code.fromBlocksTitle')}
                    >
                        <Blocks className="w-3.5 h-3.5" />
                        <span>{t('code.fromBlocks')}</span>
                    </button>
                </div>
            </div>

            <div className="relative flex flex-1 min-h-0 font-mono text-[13px] leading-5">
                <div
                    ref={gutterRef}
                    aria-hidden
                    className="flex-shrink-0 overflow-hidden select-none text-right text-slate-400 bg-slate-50 border-r border-slate-200 py-2 pr-2 pl-3"
                >
                    {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
                </div>
                <div className="relative flex-1 min-w-0">
                    <pre
                        ref={preRef}
                        aria-hidden
                        className="absolute inset-0 m-0 p-2 overflow-hidden whitespace-pre text-slate-800 pointer-events-none"
                        dangerouslySetInnerHTML={{ __html: html }}
                    />
                    <textarea
                        ref={taRef}
                        value={code}
                        onChange={(e) => {
                            setCode(e.target.value);
                            setCaret(e.target.selectionStart);
                            const typed = (e.nativeEvent as InputEvent).data;
                            // open on letters and `.`, close on anything else (space, `(`, `;` …)
                            if (typed && /[\w.]/.test(typed)) { if (!acOpen) setAcIndex(0); setAcOpen(true); }
                            else if (typed) setAcOpen(false);
                        }}
                        onSelect={updateCaret}
                        onClick={() => setAcOpen(false)}
                        onBlur={() => setAcOpen(false)}
                        onScroll={syncScroll}
                        onKeyDown={onKeyDown}
                        spellCheck={false}
                        autoCapitalize="off"
                        autoComplete="off"
                        wrap="off"
                        aria-label={t('code.editor')}
                        className="absolute inset-0 w-full h-full m-0 p-2 resize-none overflow-auto whitespace-pre bg-transparent text-transparent caret-slate-900 outline-none selection:bg-sky-400/25 selection:text-transparent"
                    />
                    <span ref={measureRef} aria-hidden className="absolute invisible whitespace-pre">0000000000</span>

                    {showList && (
                        <div
                            className="absolute z-20 flex flex-col w-80 max-w-[calc(100%-1rem)] bg-white border border-slate-300 rounded-md shadow-lg overflow-hidden font-sans"
                            style={{ top: pos.top + 22, left: Math.max(4, pos.left - ctx!.prefix.length * charW) }}
                            onMouseDown={(e) => e.preventDefault()} // keep focus in the textarea
                        >
                            <ul ref={listRef} role="listbox" className="max-h-48 overflow-y-auto py-1">
                                {items.map((s, i) => (
                                    <li
                                        key={s.label}
                                        role="option"
                                        aria-selected={i === active}
                                        onMouseEnter={() => setAcIndex(i)}
                                        onClick={() => accept(s)}
                                        className={`flex items-center gap-2 px-2 h-6 cursor-pointer font-mono text-xs ${i === active ? 'bg-sky-100' : ''}`}
                                    >
                                        {s.kind === 'fn'
                                            ? <Box className="w-3.5 h-3.5 flex-shrink-0 text-[#d35400]" />
                                            : <KeyRound className="w-3.5 h-3.5 flex-shrink-0 text-[#00979d]" />}
                                        <span className="text-slate-900">{s.label}</span>
                                        {s.params && <span className="truncate text-slate-400">({s.params.join(', ')})</span>}
                                    </li>
                                ))}
                            </ul>
                            {items[active]?.signature && (
                                <div className="border-t border-slate-200 bg-slate-50 px-2 py-1.5 text-xs">
                                    <div className="font-mono text-slate-700 break-words">{items[active].signature}</div>
                                    {items[active].detail && <div className="mt-0.5 text-slate-500">{items[active].detail}</div>}
                                </div>
                            )}
                        </div>
                    )}

                    {callFn && (
                        <div
                            className="absolute z-20 max-w-[calc(100%-1rem)] px-2 py-1 bg-slate-800 text-slate-100 rounded shadow-lg font-mono text-xs whitespace-nowrap pointer-events-none"
                            style={{ top: Math.max(2, pos.top - 26), left: Math.max(4, pos.left - 40) }}
                        >
                            {callFn.label}(
                            {callFn.params!.map((p, i) => (
                                <React.Fragment key={i}>
                                    {i > 0 && ', '}
                                    <span className={i === call!.arg ? 'text-amber-300 font-semibold underline' : ''}>{p}</span>
                                </React.Fragment>
                            ))}
                            )
                        </div>
                    )}
                </div>
            </div>

            <div className={`flex items-start gap-2 px-3 py-1.5 border-t text-xs flex-shrink-0 ${error ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                {error ? <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-600" />}
                <span className="font-mono break-all">{error ? `${t('code.error')}: ${error}` : t('code.ok')}</span>
            </div>

            {dialog && <ConfirmDialog spec={dialog} onClose={closeDialog} closeLabel={t('modal.close')} />}
        </div>
    );
}
