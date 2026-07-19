/**
 * Назначение: Парсинг БКН из ответа GET /api/v1/catalog.
 * Описание: Нормализация indirectWaterHeaters для справочника UI.
 */

import type {
  CatalogIndirectWaterHeaterItem,
  CatalogIndirectWaterHeaterType,
} from './catalogTypes';

const INDIRECT_TYPES = new Set<CatalogIndirectWaterHeaterType>([
  'indirect_wall',
  'indirect_floor',
  'storage_indirect',
]);

/**
 * @param value
 */
function readTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param value
 */
function parseIndirectType(value: unknown): CatalogIndirectWaterHeaterType | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/[\s-]+/g, '_') as CatalogIndirectWaterHeaterType;
  return INDIRECT_TYPES.has(normalized) ? normalized : null;
}

/**
 * @param row
 */
function parseCatalogIndirectWaterHeaterItem(
  row: unknown,
): CatalogIndirectWaterHeaterItem | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const model = readTrimmedString(r.model);
  const type = parseIndirectType(r.type);
  const price = Number(r.price);
  const specs =
    r.specs && typeof r.specs === 'object'
      ? (r.specs as Record<string, unknown>)
      : {};
  const volumeLiters = Number(specs.volumeLiters);
  if (
    !model
    || type == null
    || !Number.isFinite(price)
    || price < 1
    || !Number.isFinite(volumeLiters)
    || volumeLiters < 1
  ) {
    return null;
  }

  const coilPowerKw = Number(specs.powerKw);
  const minSourcePowerKw = Number(specs.minSourcePowerKw);

  return {
    model,
    brand: readTrimmedString(r.brand),
    article: readTrimmedString(r.article),
    type,
    price,
    volumeLiters,
    coilPowerKw:
      Number.isFinite(coilPowerKw) && coilPowerKw >= 0 ? coilPowerKw : null,
    minSourcePowerKw:
      Number.isFinite(minSourcePowerKw) && minSourcePowerKw >= 0.1
        ? minSourcePowerKw
        : null,
  };
}

/**
 * @param raw catalog.indirectWaterHeaters
 */
export function parseCatalogIndirectWaterHeaters(
  raw: unknown,
): CatalogIndirectWaterHeaterItem[] {
  if (!Array.isArray(raw)) return [];
  const out: CatalogIndirectWaterHeaterItem[] = [];
  for (const row of raw) {
    const item = parseCatalogIndirectWaterHeaterItem(row);
    if (item != null) out.push(item);
  }
  return out;
}
