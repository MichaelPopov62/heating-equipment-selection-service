/**
 * Назначение: Парсинг коллекторов из ответа GET /api/v1/catalog.
 * Описание: Нормализация для справочника UI и будущего алгоритма подбора в смете.
 */

import type {
  CatalogBoilerManifoldItem,
  CatalogManifoldDimensions,
  CatalogManifoldItem,
  ManifoldApplication,
} from './catalogTypes';

/**
 * @param {unknown} raw
 * @returns {CatalogManifoldDimensions | null}
 */
function parseDimensions(raw: unknown): CatalogManifoldDimensions | null {
  if (!raw || typeof raw !== 'object') return null;
  const d = raw as Record<string, unknown>;
  const width = Number(d.width);
  const height = Number(d.height);
  const depth = Number(d.depth);
  if (![width, height, depth].every((n) => Number.isFinite(n))) return null;
  return { width, height, depth };
}

/**
 * @param {unknown} value
 * @returns {ManifoldApplication | null}
 */
function parseManifoldApplication(value: unknown): ManifoldApplication | null {
  if (value === 'radiator' || value === 'underfloor') return value;
  return null;
}

/**
 * @param {unknown} row
 * @returns {CatalogManifoldItem | null}
 */
export function parseCatalogManifoldItem(row: unknown): CatalogManifoldItem | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const model = typeof r.model === 'string' ? r.model.trim() : '';
  const brand = typeof r.brand === 'string' ? r.brand.trim() : '';
  const article = typeof r.article === 'string' ? r.article.trim() : '';
  const manifoldApplication = parseManifoldApplication(r.manifoldApplication);
  const dimensions = parseDimensions(r.dimensions);
  const price = Number(r.price);
  const outletsCount = Number(r.outletsCount);

  if (
    !model
    || !brand
    || !article
    || !manifoldApplication
    || !dimensions
    || !Number.isFinite(price)
    || price < 1
    || !Number.isInteger(outletsCount)
    || outletsCount < 2
    || typeof r.hasFlowMeters !== 'boolean'
  ) {
    return null;
  }

  const connectionMainInch =
    typeof r.connectionMainInch === 'string' ? r.connectionMainInch.trim() : '';
  const connectionOutletsInch =
    typeof r.connectionOutletsInch === 'string' ? r.connectionOutletsInch.trim() : '';
  const material = typeof r.material === 'string' ? r.material.trim() : '';
  const maxPressureBar = Number(r.maxPressureBar);
  const maxTemperatureC = Number(r.maxTemperatureC);

  if (
    !connectionMainInch
    || !connectionOutletsInch
    || !material
    || !Number.isFinite(maxPressureBar)
    || !Number.isFinite(maxTemperatureC)
  ) {
    return null;
  }

  return {
    model,
    brand,
    article,
    price,
    outletsCount,
    manifoldApplication,
    hasFlowMeters: r.hasFlowMeters,
    material,
    maxPressureBar,
    maxTemperatureC,
    connectionMainInch,
    connectionOutletsInch,
    dimensions,
  };
}

/**
 * @param {unknown} row
 * @returns {CatalogBoilerManifoldItem | null}
 */
export function parseCatalogBoilerManifoldItem(row: unknown): CatalogBoilerManifoldItem | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const model = typeof r.model === 'string' ? r.model.trim() : '';
  const brand = typeof r.brand === 'string' ? r.brand.trim() : '';
  const article = typeof r.article === 'string' ? r.article.trim() : '';
  const dimensions = parseDimensions(r.dimensions);
  const price = Number(r.price);
  const circuitsCount = Number(r.circuitsCount);
  const maxPowerKw = Number(r.maxPowerKw);
  const interaxleDistanceMm = Number(r.interaxleDistanceMm);
  const maxPressureBar = Number(r.maxPressureBar);
  const maxTemperatureC = Number(r.maxTemperatureC);

  if (
    !model
    || !brand
    || !article
    || !dimensions
    || !Number.isFinite(price)
    || price < 1
    || !Number.isInteger(circuitsCount)
    || circuitsCount < 1
    || !Number.isFinite(maxPowerKw)
    || typeof r.hasInsulation !== 'boolean'
    || !Number.isFinite(interaxleDistanceMm)
    || !Number.isFinite(maxPressureBar)
    || !Number.isFinite(maxTemperatureC)
  ) {
    return null;
  }

  const connectionBoilerInch =
    typeof r.connectionBoilerInch === 'string' ? r.connectionBoilerInch.trim() : '';
  const connectionCircuitsInch =
    typeof r.connectionCircuitsInch === 'string' ? r.connectionCircuitsInch.trim() : '';
  const material = typeof r.material === 'string' ? r.material.trim() : '';

  if (!connectionBoilerInch || !connectionCircuitsInch || !material) {
    return null;
  }

  return {
    model,
    brand,
    article,
    price,
    circuitsCount,
    maxPowerKw,
    hasInsulation: r.hasInsulation,
    interaxleDistanceMm,
    connectionBoilerInch,
    connectionCircuitsInch,
    maxPressureBar,
    maxTemperatureC,
    material,
    dimensions,
  };
}

/**
 * @param {unknown} rows
 * @returns {CatalogManifoldItem[]}
 */
export function parseCatalogManifolds(rows: unknown): CatalogManifoldItem[] {
  if (!Array.isArray(rows)) return [];
  const out: CatalogManifoldItem[] = [];
  for (const row of rows) {
    const item = parseCatalogManifoldItem(row);
    if (item) out.push(item);
  }
  return out;
}

/**
 * @param {unknown} rows
 * @returns {CatalogBoilerManifoldItem[]}
 */
export function parseCatalogBoilerManifolds(rows: unknown): CatalogBoilerManifoldItem[] {
  if (!Array.isArray(rows)) return [];
  const out: CatalogBoilerManifoldItem[] = [];
  for (const row of rows) {
    const item = parseCatalogBoilerManifoldItem(row);
    if (item) out.push(item);
  }
  return out;
}
