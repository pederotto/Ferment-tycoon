#!/usr/bin/env node
/**
 * npm run i18n:check
 *
 * Re-extracts every player-facing English string from the source and checks
 * i18n/es.json against it: what is missing, what has broken placeholders, and what
 * is stale (in the dictionary but no longer in the source). Exit code 1 when
 * anything is missing or broken, so it can gate a publish.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-'));
const catalog = path.join(tmp, 'catalog.json');
execFileSync('node', [path.join(__dirname, 'extract.cjs'), catalog], { stdio: 'ignore' });

const keys = JSON.parse(fs.readFileSync(catalog, 'utf8')).map(e => e.key);
const es = JSON.parse(fs.readFileSync(path.join(root, 'i18n', 'es.json'), 'utf8'));
const stale = Object.keys(es).filter(k => !keys.includes(k));
console.log(`source keys ${keys.length}, dictionary ${Object.keys(es).length}, stale entries ${stale.length}`);
if (stale.length) console.log('  stale, e.g.: ' + stale.slice(0, 5).map(s => JSON.stringify(s.slice(0, 60))).join('  '));

let status = 0;
try {
  execFileSync('node', [path.join(__dirname, 'validate.cjs'), catalog, path.join(root, 'i18n', 'es.json')], { stdio: 'inherit' });
} catch (e) { status = e.status || 1; }
process.exit(status);
