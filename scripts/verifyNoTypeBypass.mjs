/**
 * Назначение: gate против обходов типобезопасности.
 * Описание: Падает при any / @ts-ignore / @ts-nocheck / eslint-disable для unsafe-правил.
 */

import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @type {{ dir: string; exts: RegExp }[]} */
const roots = [
  { dir: path.join(root, 'frontend', 'src'), exts: /\.(ts|tsx)$/ },
  { dir: path.join(root, 'backend', 'src'), exts: /\.(js|d\.ts)$/ },
  { dir: path.join(root, 'backend', 'scripts'), exts: /\.(js|mjs|ts)$/ },
  { dir: path.join(root, 'shared'), exts: /\.(js|ts|d\.ts)$/ },
];

/** @param {string} dir @param {RegExp} exts */
async function walk(dir, exts) {
  /** @type {string[]} */
  const out = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, exts)));
    else if (e.isFile() && exts.test(e.name)) out.push(full);
  }
  return out;
}

/** @type {{ file: string; line: number; text: string }[]} */
const hits = [];

const patterns = [
  { re: /:\s*any\b/, label: ': any' },
  { re: /\bas\s+any\b/, label: 'as any' },
  { re: /<any>/, label: '<any>' },
  { re: /@ts-ignore\b/, label: '@ts-ignore' },
  { re: /@ts-nocheck\b/, label: '@ts-nocheck' },
  { re: /eslint-disable(?:-next-line)?[^\n]*no-unsafe-/, label: 'eslint-disable no-unsafe-*' },
  { re: /eslint-disable(?:-next-line)?[^\n]*no-explicit-any/, label: 'eslint-disable no-explicit-any' },
  { re: /@param\s*\{any\}/, label: '@param {any}' },
  { re: /@returns?\s*\{any\}/, label: '@returns {any}' },
  { re: /@type\s*\{any\}/, label: '@type {any}' },
];

for (const { dir, exts } of roots) {
  for (const file of await walk(dir, exts)) {
    const content = await fs.readFile(file, 'utf8');
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      // Коментарі «без any» — не помилка
      if (/без\s+any|without\s+any|no\s+any|запрет\s+any/i.test(line)) continue;
      for (const { re, label } of patterns) {
        if (re.test(line)) {
          hits.push({
            file: path.relative(root, file),
            line: i + 1,
            text: `${label}: ${line.trim()}`,
          });
        }
      }
    }
  }
}

if (hits.length > 0) {
  console.error('verifyNoTypeBypass: FAIL');
  for (const h of hits) {
    console.error(`  ${h.file}:${h.line}  ${h.text}`);
  }
  process.exit(1);
}

console.log('verifyNoTypeBypass: OK');
