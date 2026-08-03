/**
 * Назначение: удаление служебных Mongo/share-полей из Dev-экспорта.
 */

import { isRecord } from './jsonGuards';

const TOP_LEVEL_STRIP_KEYS = new Set([
  '_id',
  '__v',
  'ownerId',
  'shareToken',
  'sharePublishedAt',
  'shareSnapshot',
  'publicPath',
]);

const CALCULATION_STRIP_KEYS = new Set([
  '_id',
  '__v',
  'id',
  'projectId',
  'createdAt',
  'updatedAt',
]);

/**
 * @param value
 * @param depth
 */
export function stripMongoExportFields(value: unknown, depth = 0): unknown {
  if (depth > 12) return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripMongoExportFields(item, depth + 1));
  }
  if (!isRecord(value)) return value;

  const out: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (TOP_LEVEL_STRIP_KEYS.has(key)) continue;
    if (key === 'projectId' && typeof entryValue === 'string') continue;
    out[key] = stripMongoExportFields(entryValue, depth + 1);
  }
  return out;
}

/**
 * @param raw
 */
export function stripCalculationExportFields(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (CALCULATION_STRIP_KEYS.has(key)) continue;
    out[key] = value;
  }
  return out;
}
