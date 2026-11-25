import { useCallback } from 'react';
import { useStore } from '../store/useStore';
import { en } from './en';
import { id } from './id';

// UI text in English and Indonesian. Long learning content (parts, lessons,
// library) lives next to its data in src/learn.

export type Lang = 'en' | 'id';
export type TKey = keyof typeof en;
export type TVars = Record<string, string | number>;

const DICTS: Record<Lang, Record<TKey, string>> = { en, id };

function format(s: string, vars?: TVars) {
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
}

// Outside React (status text built in non-component code)
export function tr(key: TKey, vars?: TVars, lang: Lang = useStore.getState().lang): string {
    return format(DICTS[lang][key] ?? en[key], vars);
}

export function useT() {
    const lang = useStore(s => s.lang);
    return useCallback((key: TKey, vars?: TVars) => tr(key, vars, lang), [lang]);
}

export function readLang(): Lang {
    try {
        const saved = localStorage.getItem('mrb_lang');
        if (saved === 'en' || saved === 'id') return saved;
    } catch { /* storage unavailable */ }
    return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('id') ? 'id' : 'en';
}
