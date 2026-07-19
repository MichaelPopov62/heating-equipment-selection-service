/**
 * Назначение: Парсинг электронакопителей из ответа GET /api/v1/catalog.
 * Описание: Нормализация waterHeaters + variants для справочника UI.
 */

import type {
  CatalogWaterHeaterItem,
  CatalogWaterHeaterVariant,
} from './catalogTypes';

/**
 * @param value
 */
function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param row
 */
function parseVariant(row: unknown): CatalogWaterHeaterVariant | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const volumeLiters = Number(r.volumeLiters);
  const price = Number(r.price);
  if (
    !Number.isFinite(volumeLiters)
    || volumeLiters < 1
    || !Number.isFinite(price)
    || price < 1
  ) {
    return null;
  }
  const powerKw = Number(r.powerKw);
  const heatingTimeMinutes = Number(r.heatingTimeMinutes);
  return {
    volumeLiters,
    price,
    powerKw: Number.isFinite(powerKw) && powerKw > 0 ? powerKw : null,
    heatingTimeMinutes:
      Number.isFinite(heatingTimeMinutes) && heatingTimeMinutes >= 1
        ? heatingTimeMinutes
        : null,
  };
}

/**
 * @param row
 */
function parseCatalogWaterHeaterItem(row: unknown): CatalogWaterHeaterItem | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const model = readTrimmedString(r.model);
  if (!model) return null;
  const variantsRaw = Array.isArray(r.variants) ? r.variants : [];
  const variants = variantsRaw
    .map(parseVariant)
    .filter((v): v is CatalogWaterHeaterVariant => v != null);
  if (variants.length === 0) return null;

  return {
    model,
    brand: readTrimmedString(r.brand),
    type: readTrimmedString(r.type) || 'electric_storage',
    variants,
  };
}

/**
 * @param raw catalog.waterHeaters
 */
export function parseCatalogWaterHeaters(raw: unknown): CatalogWaterHeaterItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CatalogWaterHeaterItem[] = [];
  for (const row of raw) {
    const item = parseCatalogWaterHeaterItem(row);
    if (item != null) out.push(item);
  }
  return out;
}
