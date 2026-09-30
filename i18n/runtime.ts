import { createTranslator, Dict, Translator } from './engine';
import { lang } from './lang';
import ES from './es.json';

/**
 * The translator for this page, or null in English (where nothing is wrapped and
 * nothing is looked up). `tr` translates a string on demand, for the few places
 * that work with display text outside JSX, such as search boxes.
 */
export const translator: Translator | null = lang === 'es' ? createTranslator(ES as Dict) : null;

export const tr = (s: string): string => (translator ? translator.tr(s) : s);

if (typeof document !== 'undefined') document.documentElement.lang = lang;
// Development aid: everything that reached the screen with letters in it and no
// translation. Read it in the console after playing: Array.from(__i18nMissing).
if (typeof window !== 'undefined' && translator) (window as unknown as { __i18nMissing: Set<string> }).__i18nMissing = translator.missing;

/** Lower-cases and drops accents, so "cafe" finds "Café" and "BODEGA" finds "bodega". */
const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Does a search box's text match something shown on screen? Checks the English
 * text and, in another language, its translation too, so a player can type either
 * ("cebada" or "barley" finds Pearl Barley), ignoring accents and case.
 */
export const searchMatch = (haystack: string, query: string): boolean => {
  const q = fold(query.trim());
  if (!q) return true;
  return fold(haystack).includes(q) || (translator !== null && fold(translator.tr(haystack)).includes(q));
};
