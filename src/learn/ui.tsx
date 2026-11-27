import React from 'react';
import { Check, Copy, type LucideIcon } from 'lucide-react';
import { useT } from '../i18n/i18n';

// Shared, neutral building blocks for the Learn and Library tabs.

// Callout for tips, "try it" steps and simulator notes
export const Note: React.FC<{ icon: LucideIcon; title: string; children: React.ReactNode }> = ({ icon: Icon, title, children }) => (
    <div className="rounded-md border border-slate-200 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            <Icon className="w-3.5 h-3.5 text-slate-500" />
            {title}
        </div>
        <p className="mt-1 text-sm text-slate-700 leading-relaxed">{children}</p>
    </div>
);

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
    const t = useT();
    const [done, setDone] = React.useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
        } catch { /* clipboard blocked */ }
    };
    return (
        <button
            onClick={copy}
            className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 h-6 px-2 rounded text-[11px] text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
            aria-label={t('lib.copyLabel')}
        >
            {done ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {done ? t('lib.copied') : t('lib.copy')}
        </button>
    );
};

// Sketch excerpt; comments are dimmed
export const CodeSample: React.FC<{ code: string; copy?: boolean }> = ({ code, copy }) => (
    <div className="relative">
        <pre className={`rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 font-mono text-slate-800 overflow-x-auto ${copy ? 'pr-20' : ''}`}>
            {code.split('\n').map((line, i) => {
                const c = line.indexOf('//');
                return (
                    <div key={i}>
                        {c < 0 ? line || ' ' : <>{line.slice(0, c)}<span className="text-slate-400">{line.slice(c)}</span></>}
                    </div>
                );
            })}
        </pre>
        {copy && <CopyButton text={code} />}
    </div>
);
