/**
 * Назначение: Парсинг унибоксов из ответа GET /api/v1/catalog.
 * Описание: Нормализация для справочника UI и подбора в смете.
 */

import type {
  CatalogManifoldDimensions,
  CatalogUniboxItem,
  UniboxConnectionFit,
  UniboxConnectionThread,
  UniboxType,
} from './catalogTypes';

const UNIBOX_TYPES = new Set<UniboxType>([
  'rtl_air',
  'rtl',
  'rtl_afc',
  'balancing_valve',
  'air_only',
]);

/**
 * @param {unknown} raw
 * @returns {CatalogManifoldDimensions | undefined}
 */
function parseDimensions(raw: unknown): CatalogManifoldDimensions | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const d = raw as Record<string, unknown>;
  const width = Number(d.width);
  const height = Number(d.height);
  const depth = Number(d.depth);
  if (![width, height, depth].every((n) => Number.isFinite(n))) return undefined;
  return { width, height, depth };
}

/**
 * @param {unknown} value
 * @returns {UniboxType | null}
 */
function parseUniboxType(value: unknown): UniboxType | null {
  if (typeof value !== 'string') return null;
  const t = value.trim() as UniboxType;
  return UNIBOX_TYPES.has(t) ? t : null;
}

/**
 * @param {unknown} row
 * @returns {CatalogUniboxItem | null}
 */
export function parseCatalogUniboxItem(row: unknown): CatalogUniboxItem | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id.trim() : '';
  const brand = typeof r.brand === 'string' ? r.brand.trim() : '';
  const model = typeof r.model === 'string' ? r.model.trim() : '';
  const type = parseUniboxType(r.type);
  const material = typeof r.material === 'string' ? r.material.trim() : '';
  const price = Number(r.price);
  const loopsCount = Number(r.loopsCount);
  const maxAreaSqM = Number(r.maxAreaSqM);
  const maxLoopLengthM = Number(r.maxLoopLengthM);
  const maxTemperatureC = Number(r.maxTemperatureC);
  const maxPressureBar = Number(r.maxPressureBar);
  const kvM3h = Number(r.kvM3h);

  if (
    !id
    || !brand
    || !model
    || !type
    || !material
    || !Number.isFinite(price)
    || price < 1
    || !Number.isInteger(loopsCount)
    || loopsCount < 1
    || !Number.isFinite(maxAreaSqM)
    || !Number.isFinite(maxLoopLengthM)
    || !Number.isFinite(maxTemperatureC)
    || !Number.isFinite(maxPressureBar)
    || !Number.isFinite(kvM3h)
  ) {
    return null;
  }

  if (!r.connection || typeof r.connection !== 'object') return null;
  const c = r.connection as Record<string, unknown>;
  const threadRaw = typeof c.thread === 'string' ? c.thread.trim() : '';
  const fitRaw = typeof c.fit === 'string' ? c.fit.trim() : '';
  if (threadRaw !== 'G1/2' && threadRaw !== 'G3/4') return null;
  if (fitRaw !== 'eurocone' && fitRaw !== 'internal_thread') return null;
  const thread = threadRaw as UniboxConnectionThread;
  const fit = fitRaw as UniboxConnectionFit;

  /** @type {CatalogUniboxItem} */
  const item: CatalogUniboxItem = {
    id,
    brand,
    model,
    type,
    loopsCount,
    maxAreaSqM,
    maxLoopLengthM,
    maxTemperatureC,
    maxPressureBar,
    kvM3h,
    connection: { thread, fit },
    material,
    price,
  };

  const optKeys = [
    'minAirTempC',
    'maxAirTempC',
    'minCoolantTempC',
    'maxCoolantTempC',
    'minFlowLph',
    'maxFlowLph',
    'maxSupplyTempC',
  ] as const;
  for (const key of optKeys) {
    if (r[key] === undefined) continue;
    const n = Number(r[key]);
    if (!Number.isFinite(n)) return null;
    item[key] = n;
  }

  const dimensions = parseDimensions(r.dimensions);
  if (dimensions) item.dimensions = dimensions;
  if (typeof r.description === 'string' && r.description.trim()) {
    item.description = r.description.trim();
  }

  return item;
}

/**
 * @param {unknown} raw
 * @returns {CatalogUniboxItem[]}
 */
export function parseCatalogUniboxes(raw: unknown): CatalogUniboxItem[] {
  if (!Array.isArray(raw)) return [];
  /** @type {CatalogUniboxItem[]} */
  const out: CatalogUniboxItem[] = [];
  for (const row of raw) {
    const item = parseCatalogUniboxItem(row);
    if (item) out.push(item);
  }
  return out;
}
