#!/usr/bin/env node
// Проверка якорей вида `path/file.ext:NN` или `file.ext:NN-MM` в документах аудита.
// Для каждого якоря: существует ли файл (от корня репо; для коротких форм — поиск по имени)
// и лежит ли номер строки в пределах длины файла.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.argv[2] || process.cwd();
const files = process.argv.slice(3);
if (!files.length) { console.error('usage: check_anchors.mjs <repoRoot> <doc...>'); process.exit(2); }

const tracked = execSync('git ls-files', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
  .toString().split('\n').filter(Boolean);
const byBasename = new Map();
for (const f of tracked) {
  const b = path.basename(f);
  if (!byBasename.has(b)) byBasename.set(b, []);
  byBasename.get(b).push(f);
}
const lineCache = new Map();
function lineCount(rel) {
  if (lineCache.has(rel)) return lineCache.get(rel);
  let n = -1;
  try { n = fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\n').length; } catch { n = -1; }
  lineCache.set(rel, n);
  return n;
}

// якорь внутри backtick-кода: путь с расширением + :NN(-MM)? (,NN)*
const RE = /`([A-Za-z0-9._\/@-]+\.(?:js|mjs|cjs|ts|tsx|jsx|json|jsonc|yaml|yml|md|d\.ts|txt|html|css))(:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)`/g;

let total = 0, uniq = new Set(), bad = [];
for (const doc of files) {
  const text = fs.readFileSync(path.join(ROOT, doc), 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    let m;
    RE.lastIndex = 0;
    while ((m = RE.exec(line)) !== null) {
      const p = m[1];
      const nums = m[2].slice(1).split(',').flatMap(s => s.split('-')).map(Number);
      total++;
      uniq.add(p + m[2]);
      // разрешение пути
      let rel = null, short = false;
      if (fs.existsSync(path.join(ROOT, p))) rel = p;
      else {
        const cands = tracked.filter(f => f === p || f.endsWith('/' + p));
        if (cands.length === 1) { rel = cands[0]; short = true; }
        else if (cands.length > 1) {
          // предпочесть кратчайший путь (корневой)
          rel = cands.sort((a, b) => a.split('/').length - b.split('/').length)[0];
          short = true;
        }
      }
      if (!rel) { bad.push({ doc, line: i + 1, anchor: m[0], why: 'ФАЙЛ НЕ НАЙДЕН' }); continue; }
      const n = lineCount(rel);
      const max = Math.max(...nums);
      if (n < 0) { bad.push({ doc, line: i + 1, anchor: m[0], why: 'ФАЙЛ НЕЧИТАЕМ' }); continue; }
      if (max > n) bad.push({ doc, line: i + 1, anchor: m[0], why: `СТРОКА ${max} > длины ${n} (${rel})` });
    }
  });
}
console.log(`Документов: ${files.length}; вхождений якорей: ${total}; уникальных: ${uniq.size}`);
if (!bad.length) console.log('ПРОБЛЕМНЫХ ЯКОРЕЙ: 0 — висячих ссылок нет.');
else {
  console.log(`ПРОБЛЕМНЫХ ЯКОРЕЙ: ${bad.length}`);
  for (const b of bad) console.log(`  ${b.doc}:${b.line}  ${b.anchor}  → ${b.why}`);
}
process.exit(bad.length ? 1 : 0);
