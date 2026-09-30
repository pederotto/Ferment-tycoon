/**
 * THE TRANSLATION ENGINE. Pure: no DOM, no React, nothing to import.
 *
 * The game's logic runs on English ids and names and never sees a translation;
 * only the text handed to the screen is translated, at the point React creates an
 * element (i18n/jsx-runtime.ts). A dictionary maps an English KEY to its
 * translation. A key is a plain sentence, or a TEMPLATE in which each
 * interpolated value is a numbered placeholder:
 *
 *   "Chapter {0} · {1}"  ->  "Capítulo {0} · {1}"
 *
 * Templates come from template literals, string concatenations and JSX text
 * broken up by {values} (scripts/i18n/extract.cjs writes them in exactly this
 * form). A translation may reorder placeholders. A placeholder's captured text is
 * itself translated, so "Shelved {0}" with {0} = "Kimchi" becomes "… Kimchi".
 *
 * When nothing matches whole, two fallbacks cover text the game glues together
 * out of separately-keyed pieces: lists ("sweet and garlicky, ripe") and runs of
 * sentences ("A. B."). Anything still unmatched is returned unchanged.
 */
export type Dict = Record<string, string>;

/** Stands in for a React element while children are flattened to one string. */
export const OPEN = '';
export const CLOSE = '';

const PH = /\{(\d+)\}/g;
const WORD = /[A-Za-zÀ-ɏ]{3,}/g;
const HAS_LETTER = /[A-Za-zÀ-ɏ]/;
const MAX_DEPTH = 4;
/** "Mar–May", "Dec–Mar": month ranges, which read the same or are split and translated by the month. */
const MONTHS_ONLY = /^(?:[A-Z][a-z]{2}(?:\s*[\u2013,-]\s*|$))+$/;
/** Text composed in Spanish at the point of use (services/gameLogic.ts) has no English key, and is not a miss. */
const ALREADY_SPANISH = /[\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00bf\u00a1]|\b(de|la|el|los|las|que|con|una?|por|para|y)\b/i;
/** A template with less literal text than this is 'generic': its captures are checked. */
const SHORT_TEMPLATE = 12;
const CACHE_LIMIT = 30000;

interface Pattern {
  re: RegExp;
  out: string;
  /** Total length of the literal text; longer means more specific. */
  spec: number;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Spanish "y" becomes "e" before i- / hi-, and "o" becomes "u" before o- / ho-. */
const joinWord = (word: 'y' | 'o', next: string): string => {
  const n = next.replace(/^[^A-Za-zÀ-ɏ]+/, '').toLowerCase();
  if (word === 'y' && /^(i(?!e)|hi(?!e))/.test(n)) return 'e';
  if (word === 'o' && /^(o|ho)/.test(n)) return 'u';
  return word;
};

export interface Translator {
  /** Translates one string. Leading and trailing whitespace is kept. */
  tr: (s: string) => string;
  /** Like tr, but does not log a miss: for a whole-sentence attempt whose pieces are tried next. */
  trFlat: (s: string) => string;
  /** True if the dictionary has an entry (exact or template) for this text. */
  has: (s: string) => boolean;
  /** Text that reached the screen with letters in it and no translation. */
  missing: Set<string>;
  size: number;
}

export function createTranslator(dict: Dict): Translator {
  const exact = new Map<string, string>();
  const exactLower = new Map<string, string>();
  const patterns: Pattern[] = [];
  const index = new Map<string, Pattern[]>();
  const loose: Pattern[] = [];
  const cache = new Map<string, string>();
  const cacheWhole = new Map<string, string>();
  let quiet = false;
  const missing = new Set<string>();

  // ---- Build.
  const wordFreq = new Map<string, number>();
  const pending: { p: Pattern; words: string[] }[] = [];
  // "· {0} still locked" is often drawn as two pieces, the dot and then "{0} still locked":
  // register the bare form of any key that begins with a separator too.
  const entries: [string, string][] = Object.entries(dict);
  for (const [k, v] of Object.entries(dict)) {
    const m = /^([,;:\u00b7\u2014\u2013-]\s*)(\S[\s\S]*)$/.exec(k);
    if (m && v.startsWith(m[1]) && !(m[2] in dict)) entries.push([m[2], v.slice(m[1].length)]);
  }
  for (const [key, val] of entries) {
    if (!val) continue;
    if (!/\{\d+\}/.test(key)) {
      exact.set(key, val);
      const low = key.toLowerCase();
      if (!exactLower.has(low)) exactLower.set(low, val);
      continue;
    }
    const lits = key.split(PH).filter((_, i) => i % 2 === 0);
    let body = '';
    let i = 0;
    let last = 0;
    key.replace(PH, (m: string, _n: string, off: number) => {
      body += escapeRe(key.slice(last, off)) + '([\\s\\S]*?)';
      last = off + m.length;
      i++;
      return m;
    });
    body += escapeRe(key.slice(last));
    const p: Pattern = { re: new RegExp('^' + body + '$'), out: val, spec: lits.join('').length };
    patterns.push(p);
    // Index by the literal word that appears in the fewest patterns, so a string
    // is only tried against patterns that share a word with it.
    const longest = lits.reduce((a, b) => (b.length > a.length ? b : a), '');
    const words = Array.from(new Set(longest.match(WORD) ?? []));
    words.forEach(w => wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1));
    pending.push({ p, words });
  }
  for (const { p, words } of pending) {
    if (!words.length) { loose.push(p); continue; }
    const w = words.reduce((a, b) => ((wordFreq.get(b) ?? 0) < (wordFreq.get(a) ?? 0) ? b : a));
    const list = index.get(w);
    if (list) list.push(p); else index.set(w, [p]);
  }
  loose.sort((a, b) => b.spec - a.spec);

  const matchCase = (src: string, out: string): string =>
    src === src.toLowerCase() ? out.charAt(0).toLowerCase() + out.slice(1) : out;

  // ---- Lookup.
  const trCapture = (s: string, depth: number): string => trString(s, depth);

  /**
   * How hard to try. 'whole': an exact key or a template, nothing cleverer (the
   * attempt at a sentence whose pieces will be tried next). 'full': everything.
   * 'fragment': a piece cut out of a longer text, where a very short generic
   * template ("One {0}") must not claim it.
   */
  type Mode = 'full' | 'whole' | 'fragment';
  const FRAGMENT_MIN_SPEC = 6;

  const fromPatterns = (core: string, depth: number, minSpec = 0): string | undefined => {
    const seen = new Set<Pattern>();
    const cands: Pattern[] = [];
    for (const w of new Set(core.match(WORD) ?? [])) {
      // A template's literal word may be the start of this one: "unit" of "{0} unit{1}" in "units".
      for (let n = w.length; n >= 3; n--) {
        const list = index.get(n === w.length ? w : w.slice(0, n));
        if (list) for (const p of list) if (!seen.has(p)) { seen.add(p); cands.push(p); }
      }
    }
    for (const p of loose) cands.push(p);
    cands.sort((a, b) => b.spec - a.spec);
    for (const p of cands) {
      if (p.spec < minSpec) break;
      const m = p.re.exec(core);
      if (!m) continue;
      // A placeholder stands for a value (a name, a number), not for several
      // sentences: "One {0}" must not swallow a whole paragraph that starts with "One".
      if (p.spec < SHORT_TEMPLATE && m.slice(1).some(c => c.length > 120 || /[a-z\u00E0-\u00FF]{2}[.!?]\s+[A-Z\u00C0-\u00DD]/.test(c))) continue;
      return p.out.replace(PH, (_x, n: string) => trCapture(m[Number(n) + 1] ?? '', depth + 1));
    }
    return undefined;
  };

  const trCore = (core: string, depth: number, mode: Mode = 'full'): string => {
    const e = exact.get(core);
    if (e !== undefined) return e;
    const viaPattern = fromPatterns(core, depth, mode === 'fragment' ? FRAGMENT_MIN_SPEC : 0);
    if (viaPattern !== undefined) return viaPattern;
    const el = exactLower.get(core.toLowerCase());
    if (el !== undefined) return matchCase(core, el);
    if (mode === 'whole' || depth >= MAX_DEPTH) return core;

    // A leading dot or dash: "· c. 800 – 1900 CE".
    const lead = /^([\u00b7\u2022\u2014\u2013,;:]\s*)(\S[\s\S]*)$/.exec(core);
    if (lead) {
      const t = trCore(lead[2], depth + 1, 'fragment');
      if (t !== lead[2]) return lead[1] + t;
    }

    // Runs of sentences ("A. B.") where each sentence is keyed on its own.
    const sentences = core.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý])/);
    if (sentences.length > 1) {
      const out = sentences.map(s => trCore(s, depth + 1, 'fragment'));
      if (out.some((o, i) => o !== sentences[i])) return out.join(' ');
    }
    // Lists ("sweet and garlicky, ripe"). Commas first, so a phrase that has an
    // entry of its own ("sweet and garlicky") is matched whole before "and" splits it.
    // "X (for sale)": a label and its trailing parenthesis are keyed separately.
    const paren = /^([\s\S]*\S)\s+(\([^()]*\))$/.exec(core);
    if (paren) {
      const a = trCore(paren[1], depth + 1, 'fragment');
      const b = trCore(paren[2], depth + 1, 'fragment');
      if (a !== paren[1] || b !== paren[2]) return `${a} ${b}`;
    }
    // Comma and semicolon lists: cover the items with the LONGEST spans that have an
    // entry of their own ("Bittersweet and tangy, with spice" is one key, not two).
    {
      const parts = core.split(/(\s*,\s*|\s*;\s*)/);
      if (parts.length >= 3) {
        const items = parts.filter((_, i) => i % 2 === 0);
        const seps = parts.filter((_, i) => i % 2 === 1);
        const known = (span: string): string | undefined => {
          const hit = exact.get(span);
          if (hit !== undefined) return hit;
          const viaP = fromPatterns(span, depth + 1, FRAGMENT_MIN_SPEC);
          if (viaP !== undefined) return viaP;
          const low = exactLower.get(span.toLowerCase());
          return low !== undefined ? matchCase(span, low) : undefined;
        };
        const out: string[] = [];
        let changed = false;
        let i = 0;
        while (i < items.length) {
          let took = false;
          for (let j = items.length; j > i; j--) {
            let span = items[i];
            for (let k = i + 1; k < j; k++) span += seps[k - 1] + items[k];
            const t = known(span);
            if (t !== undefined) { out.push(t); changed = true; i = j; took = true; break; }
          }
          if (!took) {
            const t = items[i] ? trCore(items[i], depth + 1, 'fragment') : items[i];
            if (t !== items[i]) changed = true;
            out.push(t);
            i++;
          }
          if (i < items.length) out.push(seps[i - 1]);
        }
        if (changed) return out.join('');
      }
    }
    for (const splitter of [/(\s+\u2014\s+|\s+\u00b7\s+|\s+\|\s+)/, /(\s*\u2013\s*)/, /(\s+and\s+|\s+or\s+)/]) {
      const parts = core.split(splitter);
      if (parts.length < 3) continue;
      const out: string[] = [];
      let changed = false;
      for (let i = 0; i < parts.length; i += 2) {
        const piece = parts[i];
        const t = piece ? trCore(piece, depth + 1, 'fragment') : piece;
        if (t !== piece) changed = true;
        out.push(t);
        const sep = parts[i + 1];
        if (sep === undefined) continue;
        const nextT = parts[i + 2] ? trCore(parts[i + 2], depth + 1, 'fragment') : '';
        if (/^\s+and\s+$/.test(sep)) out.push(` ${joinWord('y', nextT)} `);
        else if (/^\s+or\s+$/.test(sep)) out.push(` ${joinWord('o', nextT)} `);
        else out.push(sep);
      }
      if (changed) return out.join('');
    }
    return core;
  };

  const trString = (s: string, depth = 0, record = true, mode: Mode = 'full'): string => {
    if (!s || !HAS_LETTER.test(s)) return s;
    const store = mode === 'whole' ? cacheWhole : cache;
    if (depth === 0) {
      const hit = store.get(s);
      if (hit !== undefined) return hit;
    }
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s) as RegExpExecArray;
    const core = m[2];
    const out = core ? m[1] + trCore(core, depth, mode) + m[3] : s;
    if (depth === 0) {
      if (store.size > CACHE_LIMIT) store.clear();
      store.set(s, out);
    }
    // Text that reached the screen with letters in it and no entry: a whole string, or a
    // value captured by a template ("humidity {0}" with {0} = "holding").
    if (record && !quiet && out === s && !ALREADY_SPANISH.test(core) && !MONTHS_ONLY.test(core) && !exact.has(core) && !exactLower.has(core.toLowerCase()) && core.replace(/[-\d\s.,:;%$/()+\-–—·×]/g, '').length >= 3) missing.add(core);
    return out;
  };

  return {
    tr: s => trString(s),
    trFlat: s => { quiet = true; try { return trString(s, 0, false, 'whole'); } finally { quiet = false; } },
    has: s => {
      const core = s.trim();
      return exact.has(core) || fromPatterns(core, 0) !== undefined;
    },
    missing,
    size: exact.size + patterns.length,
  };
}
