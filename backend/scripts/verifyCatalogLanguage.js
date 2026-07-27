/**
 * Назначение: gate user-facing RU у эталонного каталога products.
 * Описание: Проверяет backend/test_data.json.example — display-поля номенклатуры (§ language-policy §19).
 * Запуск: npm run verify:catalog-language (из backend/)
 */

import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplePath = path.join(__dirname, '..', 'test_data.json.example');

/** Ключи JSON с user-facing текстом каталога. */
const DISPLAY_KEYS = new Set([
  'fuel',
  'modeName',
  'positioning',
  'description',
  'category',
  'material',
  'connectionDiameters',
]);

/** RU-маркеры в display-полях каталога (поза whitelist). */
const FORBIDDEN = [
  { re: /[ёЁ]/, label: 'буква «ё»' },
  { re: /\(отопление\)/, label: 'RU «отопление»' },
  { re: /[Вв]строен/, label: 'RU «встроенный»' },
  { re: /Скорость [123]/, label: 'RU «Скорость»' },
  { re: /— скорость/, label: 'RU «скорость»' },
  { re: /Водоснабж/, label: 'RU «Водоснабжение»' },
  { re: /Отопление\//, label: 'RU «Отопление»' },
  { re: /алюминиев|теплоотдач|антикорроз/, label: 'RU описание (legacy форми)' },
  { re: /Надежн|небольших/, label: 'RU маркетинг котла' },
  { re: /боковым|нижним|принудительной|скрытой|трехпанель|Панельный |Длинный |Стальной |Инновацион|Высокопроч|Литой /, label: 'RU описание радиатора' },
  { re: /коррозии|теплоносителя|конденсационных|сочетании|внушительной|повышенной|стандартной|эффективного|съема|Выдает|Идеален|Оптимален|Подходит|разработанный/, label: 'RU описание (legacy)' },
  { re: /^Алюминий$|^Биметалл$|^Металлопластик$/, label: 'RU material' },
  { re: /Коллектор/, label: 'RU «Коллектор» (UA: Колектор)' },
];

/**
 * @param {unknown} value
 * @param {string} keyPath
 * @param {string[]} hits
 */
function scanValue(value, keyPath, hits) {
  if (typeof value !== 'string') return;
  for (const { re, label } of FORBIDDEN) {
    if (re.test(value)) {
      hits.push(`${keyPath}: [${label}] ${JSON.stringify(value)}`);
      break;
    }
  }
}

/**
 * @param {unknown} node
 * @param {string[]} pathParts
 * @param {string[]} hits
 */
function walk(node, pathParts, hits) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => walk(item, [...pathParts, String(i)], hits));
    return;
  }
  if (!node || typeof node !== 'object') return;

  for (const [key, val] of Object.entries(node)) {
    const nextPath = [...pathParts, key];
    if (DISPLAY_KEYS.has(key)) {
      if (Array.isArray(val)) {
        val.forEach((item, i) => scanValue(item, `${nextPath.join('.')}[${i}]`, hits));
      } else {
        scanValue(val, nextPath.join('.'), hits);
      }
    }
    walk(val, nextPath, hits);
  }
}

let raw;
try {
  raw = await fs.readFile(examplePath, 'utf-8');
} catch (err) {
  console.error(`verify:catalog-language FAILED: не найден ${examplePath}`);
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}

/** @type {string[]} */
const hits = [];
walk(JSON.parse(raw), ['catalog'], hits);

if (hits.length > 0) {
  console.error('verify:catalog-language FAILED');
  for (const h of hits.slice(0, 40)) {
    console.error(`  ${h}`);
  }
  if (hits.length > 40) {
    console.error(`  … та ще ${hits.length - 40} порушень`);
  }
  process.exit(1);
}

console.log('verify:catalog-language OK');
