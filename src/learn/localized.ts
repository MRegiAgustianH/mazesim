import type { Lang } from '../i18n/i18n';
import type { PartId } from '../simulator/robotLayout';
import { HARDWARE_PARTS, LESSONS, type HardwarePart, type Lesson } from './hardwareParts';
import { CATEGORIES, LIBRARY, type LibFunction } from './libraryDocs';
import { LESSONS_ID, PARTS_ID } from './content.id';
import { CATEGORIES_ID, LIBRARY_ID } from './library.id';

// Learn / Library content in the chosen language. English is the source;
// Indonesian replaces the text fields and keeps code, pins and links.

export function getPart(id: PartId, lang: Lang): HardwarePart {
    const p = HARDWARE_PARTS[id];
    const t = lang === 'id' ? PARTS_ID[id] : null;
    if (!t) return p;
    return {
        ...p,
        name: t.name,
        role: t.role,
        description: t.description,
        specs: t.specs,
        pins: p.pins?.map((pin, i) => ({ ...pin, signal: t.pins?.[i] ?? pin.signal })),
        tip: t.tip ?? p.tip,
    };
}

export function getLessons(lang: Lang): Lesson[] {
    if (lang !== 'id') return LESSONS;
    return LESSONS.map(l => {
        const t = LESSONS_ID[l.id];
        return t ? { ...l, title: t.title, hook: t.hook, body: t.body, code: t.code ?? l.code, tryIt: t.tryIt ?? l.tryIt } : l;
    });
}

export function getLibrary(lang: Lang): LibFunction[] {
    if (lang !== 'id') return LIBRARY;
    return LIBRARY.map(f => {
        const t = LIBRARY_ID[f.name];
        if (!t) return f;
        return {
            ...f,
            summary: t.summary,
            details: t.details,
            sim: t.sim ?? f.sim,
            params: f.params.map((p, i) => ({ ...p, desc: t.params?.[i] ?? p.desc })),
        };
    });
}

export function getCategories(lang: Lang) {
    return lang === 'id' ? CATEGORIES.map(c => ({ ...c, ...CATEGORIES_ID[c.id] })) : CATEGORIES;
}
