/**
 * Назначение: Парсинг котлов из ответа GET /api/v1/catalog.
 * Описание: Нормализация doubleCircuit / singleCircuit для справочника UI.
 */

import type {
  CatalogBoilerCircuitPool,
  CatalogBoilerItem,
} from './catalogTypes';

/**
 * @param value
 */
function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param value
 */
function parseMountingType(value: unknown): 'wall' | 'floor' | null {
  if (value === 'wall' || value === 'floor') return value;
  return null;
}

/**
 * @param row
 * @param circuitPool
 */
function parseCatalogBoilerItem(
  row: unknown,
  circuitPool: CatalogBoilerCircuitPool,
): CatalogBoilerItem | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const model = readTrimmedString(r.model);
  if (!model) return null;

  const powerRaw = r.powerKw;
  const power =
    powerRaw && typeof powerRaw === 'object'
      ? (powerRaw as Record<string, unknown>)
      : {};
  const powerKwMin = Number(power.min);
  const powerKwMax = Number(power.max);
  const price = Number(r.price);
  if (
    !Number.isFinite(powerKwMin)
    || !Number.isFinite(powerKwMax)
    || !Number.isFinite(price)
    || price < 1
  ) {
    return null;
  }

  return {
    model,
    brand: readTrimmedString(r.brand),
    circuitPool,
    type: readTrimmedString(r.type) || '—',
    powerKwMin,
    powerKwMax,
    price,
    mountingType: parseMountingType(r.mountingType),
    article: readTrimmedString(r.article),
  };
}

/**
 * @param raw catalog.boilers
 */
export function parseCatalogBoilers(raw: unknown): CatalogBoilerItem[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const boilers = raw as Record<string, unknown>;
  const out: CatalogBoilerItem[] = [];

  for (const pool of ['doubleCircuit', 'singleCircuit'] as const) {
    const list = boilers[pool];
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const item = parseCatalogBoilerItem(row, pool);
      if (item != null) out.push(item);
    }
  }

  return out;
}
