#!/usr/bin/env node
/**
 * Fail if any file under reference/ or src/data contains IPUMS microdata
 * column names CASEID or PERNUM (guards against committing microdata).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['reference', join('src', 'data')];
const FORBIDDEN = /\b(CASEID|PERNUM)\b/;

/** @param {string} dir @param {string[]} out */
function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else out.push(p);
  }
}

const hits = [];
for (const rel of ROOTS) {
  const dir = join(root, rel);
  const files = [];
  walk(dir, files);
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue; // skip binary / unreadable
    }
    if (FORBIDDEN.test(text)) {
      hits.push(relative(root, file));
    }
  }
}

if (hits.length) {
  console.error(
    'Microdata guard failed: CASEID or PERNUM found (IPUMS microdata columns must not be committed):',
  );
  for (const h of hits) console.error(`  - ${h}`);
  process.exit(1);
}

console.log('OK: no CASEID/PERNUM under reference/ or src/data');
