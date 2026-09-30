#!/usr/bin/env node
/**
 * Extracts every player-facing English string in the source into a catalogue of
 * translation KEYS, in the exact form i18n/engine.ts looks them up.
 *
 *   node scripts/i18n/extract.cjs [out.json]      (default: prints a summary only)
 *
 * A key is either a plain sentence ("Fill the vessel") or a TEMPLATE in which
 * every interpolated value is a numbered placeholder ("Chapter {0} · {1}"). The
 * same templates come from three places: template literals, string
 * concatenations, and JSX elements whose text is broken up by {values}.
 *
 * What counts as text: any string literal with a space and a word, or a single
 * capitalised word ("Stir"). Single lowercase words are ids and tokens and are
 * left alone; anything that turns out to be displayed anyway is found by the
 * runtime collector (window.__i18nMissing) and by i18n/check.
 */
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const SKIP_FILE = /(Sheet|Plate|paperArt|IngredientArt|DevPanel)\.tsx?$|^index\.tsx$/;

const files = [];
const addDir = (dir, re) => fs.readdirSync(path.join(root, dir))
  .filter(f => re.test(f) && !SKIP_FILE.test(f)).forEach(f => files.push(path.join(dir, f)));
files.push('App.tsx');
addDir('components', /\.tsx?$/);
addDir('services', /\.ts$/);
addDir('.', /^(constants.*|types.*)\.ts$/);

const ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", middot: '·', mdash: '—', ndash: '–', hellip: '…', rarr: '→', larr: '←', times: '×', deg: '°', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', bull: '•', check: '✓', minus: '\u2212', rsaquo: '›', lsaquo: '‹', plusmn: '±', frac12: '½', thinsp: '\u2009', uarr: '↑', darr: '↓', asymp: '≈', le: '≤', ge: '≥' };
const decode = s => s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, e) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return String.fromCodePoint(n); }
  return ENTITIES[e] !== undefined ? ENTITIES[e] : m;
});

/** React's whitespace rules for JSX text (Babel's cleanJSXElementLiteralChild). */
const cleanJsxText = raw => {
  const lines = raw.split(/\r\n|\n|\r/);
  let lastNonEmpty = 0;
  lines.forEach((l, i) => { if (/[^ \t]/.test(l)) lastNonEmpty = i; });
  let str = '';
  lines.forEach((line, i) => {
    let t = line.replace(/\t/g, ' ');
    if (i !== 0) t = t.replace(/^[ ]+/, '');
    if (i !== lines.length - 1) t = t.replace(/[ ]+$/, '');
    if (t) { if (i !== lastNonEmpty) t += ' '; str += t; }
  });
  return decode(str);
};

const hasWord = s => /[A-Za-zÀ-ɏ]{2}/.test(s);
const NON_TEXT = [
  /^(?=.*\d)[MmLlHhVvCcSsQqTtAaZz0-9 ,.\-eE]+$/,                 // svg path data
  /^(https?:|data:|\/|\.\/|\.\.\/|@\/)/,                   // urls and paths
  /\.(png|webp|jpe?g|svg|css|ts|tsx|json)$/i,
  /^#[0-9a-fA-F]{3,8}$/,                                   // hex colours
  /^(rgba?|hsla?|var|calc|url|linear-gradient|radial-gradient)\(/,
  /^[a-z][a-z0-9]*([-_][a-z0-9]+)+$/,                      // kebab / snake ids
  /^[a-z]+[A-Z][A-Za-z]*$/,                                // camelCase
  /^[a-z0-9]+$/,                                           // single lowercase token
  /^\d/,                                                   // starts with a digit: css lengths, times
  /^(\s*[a-z-]+\s*:\s*[^:]+;?\s*)+$/,                      // css declarations
  /^([a-z-]+\([^)]*\)\s*)+$/,                            // css functions: minmax(), grayscale()
  /^\(?(min|max)-/,                                         // media queries
  /\d\s*(px|fr|rem|em|vh|vw)\b/,                           // css lengths
];
const isText = s => {
  const t = s.trim();
  if (t.length < 2 || !hasWord(t)) return false;
  if (NON_TEXT.some(re => re.test(t))) return false;
  if (/\s/.test(t)) return true;                           // several words
  return /^[A-Z][A-Za-z'’À-ɏ./&-]+$/.test(t); // one capitalised word (or Miso/Paste)
};

// Not display text, or text that must never be translated (the language names).
const NEVER = new Set(['-{0}px -{1}px', '{0}px {1}px', 'Jugar en español', 'Play in English', 'IBM Plex Mono, monospace', 'English', 'Español']);
const SELECTOR = /^[.#[][\w\-.#[\]="', >:*]+$/;
const catalogue = new Map(); // key -> { key, kinds:Set, where:[...], count }
const add = (key, kind, file, line, ctx) => {
  key = key.trim();
  if (!key || NEVER.has(key) || SELECTOR.test(key)) return;
  let e = catalogue.get(key);
  if (!e) { e = { key, kinds: new Set(), where: [], ctx: new Set(), count: 0 }; catalogue.set(key, e); }
  e.count++;
  e.kinds.add(kind);
  if (ctx) e.ctx.add(ctx);
  if (e.where.length < 3) e.where.push(`${file}:${line}`);
};

const SKIP_ATTRS = new Set(['className', 'id', 'key', 'style', 'viewBox', 'd', 'fill', 'stroke', 'transform', 'src', 'href', 'type', 'role', 'name', 'htmlFor', 'xmlns', 'points', 'filter', 'mask', 'clipPath', 'fontFamily', 'textAnchor', 'width', 'height', 'data-unit', 'to', 'sheet', 'preserveAspectRatio', 'strokeLinecap', 'strokeLinejoin', 'mode', 'kind']);
const TEXT_ATTRS = new Set(['title', 'aria-label', 'placeholder', 'alt', 'label', 'aria-description']);

for (const f of files) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const line = n => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  /** Text of an expression that is a plain string, else null. */
  const literalText = n => (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null;

  /** Template from a TemplateExpression: static parts + {i}. */
  const templateOf = n => {
    let i = 0;
    let s = n.head.text;
    n.templateSpans.forEach(sp => { s += `{${i++}}` + sp.literal.text; });
    return s;
  };

  /** Flattens a + b + c chains whose operands are strings or expressions. */
  const concatParts = n => {
    const out = [];
    const walk = x => {
      if (ts.isParenthesizedExpression(x)) return walk(x.expression);
      if (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.PlusToken) { walk(x.left); walk(x.right); return; }
      const lit = literalText(x);
      if (lit !== null) out.push({ lit });
      else if (ts.isTemplateExpression(x)) out.push({ tpl: x });
      else out.push({ expr: true });
    };
    walk(n);
    return out;
  };

  const consumed = new Set();
  const visit = n => {
    // ---- JSX element: children form one template when text is mixed with values.
    if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      const kids = n.children;
      const hasText = kids.some(k => ts.isJsxText(k) && hasWord(cleanJsxText(k.text)));
      if (hasText) {
        let i = 0, key = '';
        for (const k of kids) {
          if (ts.isJsxText(k)) key += cleanJsxText(k.text);
          else if (ts.isJsxExpression(k)) {
            if (!k.expression) continue;
            const lit = literalText(k.expression);
            if (lit !== null) key += lit; else key += `{${i++}}`;
          } else key += `{${i++}}`;
        }
        const tag = ts.isJsxElement(n) ? n.openingElement.tagName.getText(sf) : 'Fragment';
        // A template that is only placeholders and punctuation is not text.
        if (hasWord(key.replace(/\{\d+\}/g, ''))) add(key, 'jsx', f, line(n), tag);
      }
    }
    // ---- Attributes.
    else if (ts.isJsxAttribute(n) && n.initializer) {
      const name = n.name.getText(sf);
      if (TEXT_ATTRS.has(name) || !SKIP_ATTRS.has(name)) {
        const init = n.initializer;
        const expr = ts.isJsxExpression(init) ? init.expression : init;
        if (expr) {
          const lit = literalText(expr);
          if (lit !== null && TEXT_ATTRS.has(name) && isText(lit)) add(lit, 'attr', f, line(n), name);
        }
      }
    }
    // ---- Template literals with values.
    if (ts.isTemplateExpression(n)) {
      const key = templateOf(n);
      if (hasWord(key.replace(/\{\d+\}/g, ''))) {
        const insideClass = n.parent && ts.isJsxExpression(n.parent) && n.parent.parent && ts.isJsxAttribute(n.parent.parent) && SKIP_ATTRS.has(n.parent.parent.name.getText(sf));
        const nonText = NON_TEXT.some(re => re.test(key.replace(/\{\d+\}/g, 'X').trim()));
        if (!insideClass && !nonText && /[A-Za-z]{2}/.test(key.replace(/\{\d+\}/g, '')) && (/\s/.test(key.trim()) || /^[A-Z]/.test(key))) add(key, 'template', f, line(n));
      }
    }
    // ---- String concatenation. A chain is one template; its literal operands are
    // parts of it and are not keys on their own.
    else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken && !(ts.isBinaryExpression(n.parent) && n.parent.operatorToken.kind === ts.SyntaxKind.PlusToken)) {
      const parts = concatParts(n);
      if (parts.some(p => p.lit !== undefined && hasWord(p.lit))) {
        let i = 0, key = '';
        for (const p of parts) key += p.lit !== undefined ? p.lit : (p.tpl ? p.tpl.head.text + p.tpl.templateSpans.map(sp => `{${i++}}` + sp.literal.text).join('') : `{${i++}}`);
        const bare = key.replace(/\{\d+\}/g, '');
        if (hasWord(bare) && (/\s/.test(bare.trim()) || /^[A-Z]/.test(key)) && parts.length > 1) {
          add(key, parts.some(p => p.expr || p.tpl) ? 'concat' : 'joined', f, line(n));
          const mark = x => {
            if (ts.isParenthesizedExpression(x)) return mark(x.expression);
            if (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.PlusToken) { mark(x.left); mark(x.right); return; }
            consumed.add(x);
          };
          mark(n);
        }
      }
    }
    // ---- Plain string literals.
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))) {
      const p = n.parent;
      const skip =
        ts.isImportDeclaration(p) || ts.isExportDeclaration(p) ||
        (ts.isJsxAttribute(p) && SKIP_ATTRS.has(p.name.getText(sf))) ||
        (ts.isPropertyAssignment(p) && p.name === n) ||
        (ts.isElementAccessExpression(p) && p.argumentExpression === n) ||
        (ts.isCaseClause(p) && p.expression === n) ||
        (ts.isLiteralTypeNode && p.parent && ts.isLiteralTypeNode(p)) ||
        (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(p.operatorToken.kind)) ||
        (ts.isCallExpression(p) && /^(console\.(log|warn|error)|document\.(getElementById|createElement|querySelector)|localStorage\.(getItem|setItem|removeItem)|\w+\.(includes|startsWith|endsWith|indexOf|has|get|test|match|split|replace|join|localeCompare|addEventListener|removeEventListener|getAttribute|setAttribute|querySelector|querySelectorAll|toLocaleString|toLocaleDateString))$/.test(p.expression.getText(sf)) && p.arguments.includes(n) && !/\.(replace|join)$/.test(p.expression.getText(sf)) || (ts.isCallExpression(p) && /^(require|Symbol|parseInt|parseFloat|Number|String|useState|useRef|createContext|memo|lazy|t)$/.test(p.expression.getText(sf))));
      // A lone lowercase word is an id, except where it is plainly drawn: a branch of a
      // conditional (or &&, ||) that sits among a JSX element's children.
      const drawn = (() => {
        let x = n;
        for (let up = 0; up < 6 && x.parent; up++) {
          const q = x.parent;
          if (ts.isJsxExpression(q)) return !!q.parent && (ts.isJsxElement(q.parent) || ts.isJsxFragment(q.parent));
          if (ts.isConditionalExpression(q) || ts.isParenthesizedExpression(q) || ts.isTemplateSpan(q) || ts.isTemplateExpression(q) ||
              (ts.isBinaryExpression(q) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(q.operatorToken.kind))) { x = q; continue; }
          return false;
        }
        return false;
      })();
      const lone = drawn && /^[a-z][a-z'-]{1,}$/.test(n.text.trim()) && n.text.trim().length >= 3;
      if (!skip && !consumed.has(n) && (isText(n.text) || lone)) {
        const parent = p && ts.isPropertyAssignment(p) ? p.name.getText(sf).replace(/['"]/g, '') : (p && ts.isCallExpression(p) ? p.expression.getText(sf).slice(0, 24) : ts.SyntaxKind[p.kind]);
        add(n.text, 'literal', f, line(n), parent);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}

// Display words the extractor skips on purpose (single lowercase tokens look like ids).
// Found while playing in Spanish; one per line in scripts/i18n/extra-keys.txt.
const extraFile = path.join(__dirname, 'extra-keys.txt');
if (fs.existsSync(extraFile)) {
  fs.readFileSync(extraFile, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).forEach(k => add(k, 'extra', 'scripts/i18n/extra-keys.txt', 1));
}

const list = [...catalogue.values()].map(e => ({ key: e.key, kinds: [...e.kinds], ctx: [...e.ctx].slice(0, 3), where: e.where, count: e.count }));
const words = list.reduce((a, e) => a + e.key.replace(/\{\d+\}/g, '').split(/\s+/).filter(Boolean).length, 0);
const byKind = {};
list.forEach(e => e.kinds.forEach(k => { byKind[k] = (byKind[k] || 0) + 1; }));
console.log(`files ${files.length}  unique keys ${list.length}  words ${words}`);
console.log('by kind', byKind);
console.log('templates (with placeholders):', list.filter(e => /\{\d+\}/.test(e.key)).length);
if (process.argv[2]) { fs.writeFileSync(process.argv[2], JSON.stringify(list, null, 1)); console.log('wrote', process.argv[2]); }
module.exports = { cleanJsxText };
