/**
 * WHICH LANGUAGE THE PAGE IS IN. Read once, when the page loads: switching
 * saves the choice and reloads, so nothing in the running game ever has to
 * change language under its own feet (the simulation, the saves and every id
 * stay English regardless).
 *
 * Order of precedence: a `?lang=es` in the address, then the saved choice, then
 * the browser's own language, then English.
 */
export type Lang = 'en' | 'es';

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];

const KEY = 'fermenta.lang';

const read = (): Lang => {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q === 'es' || q === 'en') { window.localStorage.setItem(KEY, q); return q; }
    const saved = window.localStorage.getItem(KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch { /* storage blocked: fall through to the browser's language */ }
  try {
    if ((window.navigator.language || '').toLowerCase().startsWith('es')) return 'es';
  } catch { /* no navigator */ }
  return 'en';
};

export const lang: Lang = typeof window === 'undefined' ? 'en' : read();

/** Saves the choice and reloads the page in it. The game's own save is written on the way out. */
export const setLang = (next: Lang): void => {
  try { window.localStorage.setItem(KEY, next); } catch { /* blocked: the address parameter still works */ }
  const url = new URL(window.location.href);
  url.searchParams.set('lang', next);
  window.location.replace(url.toString());
};
