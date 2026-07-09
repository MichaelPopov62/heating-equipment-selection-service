/**
 * Назначение: паспортная геометрия серий котельных коллекторов (boilerManifold).
 * Описание: фиксированные габариты и формула ширины для известных серий каталога.
 */

/** @typedef {'fado_kgz'} BoilerManifoldSeriesId */

/** Допуск сравнения габаритов, мм. */
export const BOILER_MANIFOLD_GEOMETRY_TOLERANCE_MM = 0.5;

/**
 * @typedef {Object} BoilerManifoldSeriesGeometryPreset
 * @property {number} depth Глубина, мм.
 * @property {number} height Высота, мм.
 * @property {number} interaxleDistanceMm Межосевое, мм (для формулы ширины FADO).
 * @property {string} connectionBoilerInch
 * @property {string} connectionCircuitsInch
 * @property {number} maxPowerKw Ожидаемая maxPowerKw серии.
 * @property {number} maxPressureBar
 * @property {number} maxTemperatureC
 * @property {Record<number, number>} widthByCircuitsCount Таблица ширины по circuitsCount.
 */

/** @type {Record<BoilerManifoldSeriesId, Readonly<BoilerManifoldSeriesGeometryPreset>>} */
export const BOILER_MANIFOLD_SERIES_GEOMETRY = Object.freeze({
  fado_kgz: Object.freeze({
    depth: 135,
    height: 178,
    interaxleDistanceMm: 125,
    connectionBoilerInch: '1 1/2',
    connectionCircuitsInch: '1 1/2',
    maxPowerKw: 85,
    maxPressureBar: 6,
    maxTemperatureC: 100,
    widthByCircuitsCount: Object.freeze({
      3: 500,
      5: 750,
      7: 1000,
    }),
  }),
});

/**
 * Нормализует обозначение резьбы.
 *
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeBoilerManifoldInchLabel(raw) {
  return String(raw ?? '')
    .replace(/[<>]/g, '')
    .replace(/"/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {Record<string, unknown>} item
 * @returns {BoilerManifoldSeriesId | null}
 */
export function resolveBoilerManifoldSeriesId(item) {
  const article = String(item.article ?? '').trim().toUpperCase();
  const brand = String(item.brand ?? '').trim().toLowerCase();

  if (article.startsWith('KGZ') || brand === 'fado') {
    return 'fado_kgz';
  }
  return null;
}

/**
 * Ожидаемая ширина котельного коллектора FADO: (circuitsCount + 1) × межосевое.
 *
 * @param {number} circuitsCount
 * @param {number} interaxleDistanceMm
 * @returns {number}
 */
export function expectedBoilerManifoldWidthMm(circuitsCount, interaxleDistanceMm) {
  return (circuitsCount + 1) * interaxleDistanceMm;
}

/**
 * @param {Record<string, unknown>} item
 * @param {string} ctx
 */
export function assertKnownBoilerManifoldSeriesGeometry(item, ctx) {
  const seriesId = resolveBoilerManifoldSeriesId(item);
  if (!seriesId) return;

  const preset = BOILER_MANIFOLD_SERIES_GEOMETRY[seriesId];
  const circuitsCount = Number(item.circuitsCount);

  const expectedFromTable = preset.widthByCircuitsCount[circuitsCount];
  if (expectedFromTable == null) {
    throw new Error(
      `Каталог: ${ctx} — для серии ${seriesId} circuitsCount=${circuitsCount} не поддерживается.`,
    );
  }

  const interaxle = Number(item.interaxleDistanceMm);
  if (Math.abs(interaxle - preset.interaxleDistanceMm) > BOILER_MANIFOLD_GEOMETRY_TOLERANCE_MM) {
    throw new Error(
      `Каталог: ${ctx} — interaxleDistanceMm=${interaxle}, ожидалось ${preset.interaxleDistanceMm} (серия ${seriesId}).`,
    );
  }

  const expectedW = expectedBoilerManifoldWidthMm(circuitsCount, preset.interaxleDistanceMm);
  if (Math.abs(expectedW - expectedFromTable) > BOILER_MANIFOLD_GEOMETRY_TOLERANCE_MM) {
    throw new Error(
      `Каталог: ${ctx} — внутренняя ошибка пресета ширины для ${seriesId}.`,
    );
  }

  if (normalizeBoilerManifoldInchLabel(item.connectionBoilerInch) !== preset.connectionBoilerInch) {
    throw new Error(
      `Каталог: ${ctx} — connectionBoilerInch должен быть "${preset.connectionBoilerInch}" (серия ${seriesId}).`,
    );
  }
  if (
    normalizeBoilerManifoldInchLabel(item.connectionCircuitsInch) !== preset.connectionCircuitsInch
  ) {
    throw new Error(
      `Каталог: ${ctx} — connectionCircuitsInch должен быть "${preset.connectionCircuitsInch}" (серия ${seriesId}).`,
    );
  }

  const maxPowerKw = Number(item.maxPowerKw);
  if (Math.abs(maxPowerKw - preset.maxPowerKw) > 0.01) {
    throw new Error(
      `Каталог: ${ctx} — maxPowerKw=${maxPowerKw}, ожидалось ${preset.maxPowerKw} (серия ${seriesId}).`,
    );
  }

  const dimensions = item.dimensions;
  if (!dimensions || typeof dimensions !== 'object') {
    throw new Error(`Каталог: ${ctx} — dimensions обязателен для серии ${seriesId}.`);
  }

  const dim = /** @type {Record<string, unknown>} */ (dimensions);
  const depth = Number(dim.depth);
  const height = Number(dim.height);
  const width = Number(dim.width);

  if (Math.abs(depth - preset.depth) > BOILER_MANIFOLD_GEOMETRY_TOLERANCE_MM) {
    throw new Error(
      `Каталог: ${ctx} — depth=${depth}, ожидалось ${preset.depth} (серия ${seriesId}).`,
    );
  }
  if (Math.abs(height - preset.height) > BOILER_MANIFOLD_GEOMETRY_TOLERANCE_MM) {
    throw new Error(
      `Каталог: ${ctx} — height=${height}, ожидалось ${preset.height} (серия ${seriesId}).`,
    );
  }
  if (Math.abs(width - expectedFromTable) > BOILER_MANIFOLD_GEOMETRY_TOLERANCE_MM) {
    throw new Error(
      `Каталог: ${ctx} — width=${width}, ожидалось ${expectedFromTable} ` +
        `(серия ${seriesId}: (${circuitsCount}+1)×${preset.interaxleDistanceMm}).`,
    );
  }
}
