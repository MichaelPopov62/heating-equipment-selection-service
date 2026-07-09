/**
 * Назначение: паспортная геометрия серий коллекторов (manifold).
 * Описание: формулы ширины от числа выходов и фиксированные H×D для известных серий каталога.
 */

/** @typedef {'giacomini_r553' | 'valtec_vtc589'} ManifoldSeriesId */

/** Допуск сравнения габаритов, мм. */
export const MANIFOLD_GEOMETRY_TOLERANCE_MM = 0.5;

/**
 * @typedef {Object} ManifoldSeriesGeometryPreset
 * @property {number} depth Глубина, мм.
 * @property {number} height Высота, мм.
 * @property {number} widthBase База формулы ширины, мм.
 * @property {number} widthStepPerOutlet Приращение ширины на один выход, мм.
 * @property {string} connectionMainInch Каноническое обозначение магистрали.
 * @property {string} connectionOutletsInch Каноническое обозначение отводов.
 * @property {number} outletsMin Минимум выходов для серии.
 * @property {number} outletsMax Максимум выходов для серии.
 */

/** @type {Record<ManifoldSeriesId, Readonly<ManifoldSeriesGeometryPreset>>} */
export const MANIFOLD_SERIES_GEOMETRY = Object.freeze({
  giacomini_r553: Object.freeze({
    depth: 116.6,
    height: 473,
    widthBase: 277,
    widthStepPerOutlet: 50,
    connectionMainInch: '1',
    connectionOutletsInch: '3/4',
    outletsMin: 3,
    outletsMax: 12,
  }),
  valtec_vtc589: Object.freeze({
    depth: 82,
    height: 313,
    widthBase: 45,
    widthStepPerOutlet: 50,
    connectionMainInch: '1',
    connectionOutletsInch: '3/4',
    outletsMin: 4,
    outletsMax: 10,
  }),
});

/**
 * Нормализует обозначение резьбы (убирает дюймовые кавычки и лишние пробелы).
 *
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeInchLabel(raw) {
  return String(raw ?? '')
    .replace(/[<>]/g, '')
    .replace(/"/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ожидаемая ширина коллектора по паспорту серии, мм.
 *
 * @param {number} outletsCount
 * @param {ManifoldSeriesGeometryPreset} preset
 * @returns {number}
 */
export function expectedManifoldWidthMm(outletsCount, preset) {
  return preset.widthBase + outletsCount * preset.widthStepPerOutlet;
}

/**
 * Определяет серию коллектора по артикулу и бренду.
 *
 * @param {Record<string, unknown>} item
 * @returns {ManifoldSeriesId | null}
 */
export function resolveManifoldSeriesId(item) {
  const article = String(item.article ?? '').toUpperCase();
  const brand = String(item.brand ?? '').trim().toLowerCase();

  if (article.startsWith('R553') || brand === 'giacomini') {
    return 'giacomini_r553';
  }
  if (article.includes('VTC.589') || article.includes('VTc.589') || brand === 'valtec') {
    return 'valtec_vtc589';
  }
  return null;
}

/**
 * Проверяет геометрию и подключения для известной серии коллектора.
 * Для неизвестной серии — no-op (достаточно универсального контракта validateManifold).
 *
 * @param {Record<string, unknown>} item — нормализованная позиция manifold
 * @param {string} ctx — контекст ошибки, например manifold[2]
 */
export function assertKnownManifoldSeriesGeometry(item, ctx) {
  const seriesId = resolveManifoldSeriesId(item);
  if (!seriesId) return;

  const preset = MANIFOLD_SERIES_GEOMETRY[seriesId];
  const outletsCount = Number(item.outletsCount);

  if (outletsCount < preset.outletsMin || outletsCount > preset.outletsMax) {
    throw new Error(
      `Каталог: ${ctx} — для серии ${seriesId} outletsCount=${outletsCount} ` +
        `вне диапазона ${preset.outletsMin}…${preset.outletsMax}.`,
    );
  }

  const expectedW = expectedManifoldWidthMm(outletsCount, preset);

  if (normalizeInchLabel(item.connectionMainInch) !== preset.connectionMainInch) {
    throw new Error(
      `Каталог: ${ctx} — connectionMainInch должен быть "${preset.connectionMainInch}" (серия ${seriesId}).`,
    );
  }
  if (normalizeInchLabel(item.connectionOutletsInch) !== preset.connectionOutletsInch) {
    throw new Error(
      `Каталог: ${ctx} — connectionOutletsInch должен быть "${preset.connectionOutletsInch}" (серия ${seriesId}).`,
    );
  }

  const dimensions = item.dimensions;
  if (!dimensions || typeof dimensions !== 'object') {
    throw new Error(`Каталог: ${ctx} — dimensions обязателен для серии ${seriesId}.`);
  }

  const depth = Number(/** @type {Record<string, unknown>} */ (dimensions).depth);
  const height = Number(/** @type {Record<string, unknown>} */ (dimensions).height);
  const width = Number(/** @type {Record<string, unknown>} */ (dimensions).width);

  if (Math.abs(depth - preset.depth) > MANIFOLD_GEOMETRY_TOLERANCE_MM) {
    throw new Error(
      `Каталог: ${ctx} — depth=${depth}, ожидалось ${preset.depth} (серия ${seriesId}).`,
    );
  }
  if (Math.abs(height - preset.height) > MANIFOLD_GEOMETRY_TOLERANCE_MM) {
    throw new Error(
      `Каталог: ${ctx} — height=${height}, ожидалось ${preset.height} (серия ${seriesId}).`,
    );
  }
  if (Math.abs(width - expectedW) > MANIFOLD_GEOMETRY_TOLERANCE_MM) {
    throw new Error(
      `Каталог: ${ctx} — width=${width}, ожидалось ${expectedW} ` +
        `(серия ${seriesId}: ${preset.widthBase} + ${outletsCount}×${preset.widthStepPerOutlet}).`,
    );
  }
}
