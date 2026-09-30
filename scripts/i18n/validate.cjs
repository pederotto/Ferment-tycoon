#!/usr/bin/env node
/**
 * Checks a translation file against the keys it is meant to cover.
 *
 *   node scripts/i18n/validate.cjs <keys.json> <translations.json>
 *
 * <keys.json>          an array of { key } objects (a batch), or a catalogue
 * <translations.json>  { "English key": "Traducción" }
 *
 * Errors (exit 1): a missing or empty translation, a placeholder set that differs
 * from the key's, leading/trailing whitespace, a stray full stop on a fragment or a
 * missing one on a sentence. Warnings: identical to the English (fine for names,
 * suspicious for sentences), or much longer than the English.
 */
const fs = require('fs');

const [keysFile, outFile] = process.argv.slice(2);
if (!keysFile || !outFile) { console.error('usage: validate.cjs <keys.json> <translations.json>'); process.exit(2); }

const keys = JSON.parse(fs.readFileSync(keysFile, 'utf8')).map(e => (typeof e === 'string' ? e : e.key));
let out;
try { out = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch (e) { console.error('cannot read ' + outFile + ': ' + e.message); process.exit(1); }
if (out && out.translations && typeof out.translations === 'object') out = out.translations;

const phs = s => (s.match(/\{\d+\}/g) || []).sort().join(',');
const errors = [];
const warns = [];
let same = 0;

for (const k of keys) {
  const v = out[k];
  if (typeof v !== 'string' || !v.trim()) { errors.push(['MISSING', k]); continue; }
  if (phs(k) !== phs(v)) errors.push(['PLACEHOLDERS ' + phs(k) + ' vs ' + phs(v), k, v]);
  if (v !== v.trim()) errors.push(['WHITESPACE', k, v]);
  const bare = k.replace(/\{\d+\}/g, '').trim();
  const endsStop = s => /[.!?…]$/.test(s.replace(/["”’)]+$/, ''));
  if (bare.length > 12 && /\s/.test(bare)) {
    if (endsStop(k) && !endsStop(v)) errors.push(['LOST FINAL PUNCTUATION', k, v]);
    if (!endsStop(k) && endsStop(v) && !/[?!]$/.test(k)) errors.push(['ADDED FINAL FULL STOP (fragment)', k, v]);
  }
  if (/^[a-z]/.test(k) && /^[A-ZÁÉÍÓÚÑ]/.test(v)) warns.push(['CAPITALISED A LOWERCASE FRAGMENT', k, v]);
  if (v === k) { same++; if (bare.split(/\s+/).length >= 4) warns.push(['UNCHANGED SENTENCE', k]); }
  if (bare.length >= 8 && v.length > bare.length * 1.9 + 12) warns.push(['MUCH LONGER', k, v]);
}
const extra = Object.keys(out).filter(k => !keys.includes(k));
if (extra.length) warns.push(['EXTRA KEYS (not in the batch)', extra.slice(0, 5).join(' | ')]);

const show = (label, list, n) => { if (!list.length) return; console.log(`\n${label}: ${list.length}`); list.slice(0, n).forEach(r => console.log('  ' + r.map(x => JSON.stringify(x)).join('  ->  '))); };
console.log(`keys ${keys.length}  translated ${keys.length - errors.filter(e => e[0] === 'MISSING').length}  identical to English ${same}`);
show('ERRORS', errors, 40);
show('WARNINGS', warns, 15);
process.exit(errors.length ? 1 : 0);
