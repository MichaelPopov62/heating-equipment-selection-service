/**
 * Назначение: удаление служебных полей MongoDB из Dev-экспорта/импорта.
 * Описание: санитизация payload перед записью или после чтения JSON-файла.
 */

import { isPlainObject } from '../utils/isPlainObject.js';

/** Ключи верхнего уровня project/share, которые не переносятся между окружениями. */
const TOP_LEVEL_STRIP_KEYS = new Set([
  '_id',
  '__v',
  'ownerId',
  'shareToken',
  'sharePublishedAt',
  'shareSnapshot',
  'publicPath',
]);

/** Ключи документа calculation, которые не переносятся. */
const CALCULATION_STRIP_KEYS = new Set([
  '_id',
  '__v',
  'id',
  'projectId',
  'createdAt',
  'updatedAt',
]);

/**
 * Удаляет служебные поля из объекта расчёта импорта.
 *
 * @param {unknown} raw
 * @returns {Record<string, unknown>}
 */
export function stripCalculationImportFields(raw) {
  if (!isPlainObject(raw)) {
    return {};
  }
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (CALCULATION_STRIP_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Удаляет projectId из survey перед сохранением в целевую БД.
 *
 * @param {unknown} survey
 * @returns {Record<string, unknown> | undefined}
 */
export function stripSurveyProjectId(survey) {
  if (!isPlainObject(survey)) return undefined;
  const { projectId, ...rest } = survey;
  void projectId;
  return /** @type {Record<string, unknown>} */ ({ ...rest });
}

/**
 * Рекурсивно удаляет известные Mongo/share-ключи (ограниченная глубина для Mixed-полей).
 *
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {unknown}
 */
export function stripMongoExportFields(value, depth = 0) {
  if (depth > 12) return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripMongoExportFields(item, depth + 1));
  }
  if (!isPlainObject(value)) return value;

  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (TOP_LEVEL_STRIP_KEYS.has(key)) continue;
    if (key === 'projectId' && typeof entryValue === 'string') continue;
    out[key] = stripMongoExportFields(entryValue, depth + 1);
  }
  return out;
}
