import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

export interface DialogAction {
    label: string;
    primary?: boolean;
    onClick: () => void;
}

export interface DialogSpec {
    title: string;
    message: string;
    actions: DialogAction[];
}

// In-app replacement for window.confirm. Escape or the backdrop cancels.
// Portalled to <body> so the editor panel's stacking context can't put the
// simulator panel on top of it.
export function ConfirmDialog({ spec, onClose, closeLabel }: { spec: DialogSpec; onClose: () => void; closeLabel: string }) {
    const primaryRef = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
        primaryRef.current?.focus();
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40" onMouseDown={onClose}>
            <div
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-title"
                aria-describedby="confirm-text"
                className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-sm w-full mx-4 overflow-hidden text-left"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
                    <div className="flex items-center space-x-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <span id="confirm-title" className="font-semibold text-slate-900">{spec.title}</span>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors" aria-label={closeLabel}>
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <p id="confirm-text" className="px-5 py-5 text-sm text-slate-600">{spec.message}</p>
                <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap gap-2">
                    {spec.actions.map((a, i) => (
                        <button
                            key={i}
                            ref={a.primary ? primaryRef : undefined}
                            onClick={() => { onClose(); a.onClick(); }}
                            className={`flex-1 min-w-[7rem] h-9 px-3 rounded-md text-sm font-medium transition-colors ${a.primary
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700'}`}
                        >
                            {a.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>,
        document.body,
    );
}
