/**
 * Назначение: verify размещения типов — SSOT enum, исключения, парсеры.
 * Запуск: npm run verify:types-placement (из frontend/)
 */

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** @type {string[]} */
const DOCUMENTED_TYPE_EXCEPTIONS = [
  'components/SharePresentationPage/SharePresentationPage.tsx',
  'surveySession/types.ts',
  'services/catalogTypes.ts',
  'shell/appChromeContext.ts',
];

for (const rel of DOCUMENTED_TYPE_EXCEPTIONS) {
  assert.ok(
    existsSync(path.join(srcRoot, rel)),
    `задокументированное исключение отсутствует: ${rel}`,
  );
}

/** @param {string} dir */
function collectTsFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** SSOT RoomExteriorLayout — только types/rooms.ts */
let roomExteriorLayoutDeclCount = 0;
for (const filePath of collectTsFiles(srcRoot)) {
  const rel = path.relative(srcRoot, filePath).replace(/\\/g, '/');
  const content = readFileSync(filePath, 'utf8');
  if (!/export type RoomExteriorLayout\b/.test(content)) continue;
  roomExteriorLayoutDeclCount += 1;
  assert.equal(
    rel,
    'types/rooms.ts',
    `RoomExteriorLayout объявлен вне SSOT: ${rel}`,
  );
}
assert.equal(roomExteriorLayoutDeclCount, 1, 'RoomExteriorLayout должен быть объявлен ровно один раз');

/** Парсеры — только utils/parsers/, не корень utils/ */
const utilsRoot = path.join(srcRoot, 'utils');
for (const entry of readdirSync(utilsRoot, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  assert.ok(
    !/^parse.*\.ts$/.test(entry.name),
    `parse*.ts в корне utils/ запрещён: utils/${entry.name} → utils/parsers/`,
  );
}

console.log('verify:types-placement — OK');
