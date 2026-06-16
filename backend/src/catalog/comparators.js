/**
 * Назначение: сортировка и сравнение позиций каталога.
 * Описание: переиспользуемые компараторы и хелперы для индексов, API и подбора оборудования
 * по полям нормализованного каталога (Mongo или JSON после validateCatalog).
 */

/**
 * Подключаем типы из отдельного файла.
 * (Это типизация для редактора/TS Server; на рантайм не влияет.)
 * @typedef {import('./types.d.ts').BoilerCatalogItem} BoilerCatalogItem
 * @typedef {import('./types.d.ts').WaterHeaterCatalogItemNormalized} WaterHeaterCatalogItemNormalized
 */

/**
 * Безопасно приводим значение к числу.
 * @param {unknown} x
 * @param {number} [fallback=0]
 * @returns {number}
 */
function asNumber(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Берём минимальный объём среди вариантов водонагревателя (литры).
 * @param {import('./types').WaterHeaterCatalogItemNormalized | Record<string, unknown> | null | undefined} item
 * @returns {number}
 */
function waterHeaterMinVolumeLiters(item) {
  const variants = /** @type {{ volumeLiters?: unknown }[]} */ (
    /** @type {Record<string, unknown>} */ (item ?? {}).variants ?? []
  );
  if (!Array.isArray(variants) || variants.length === 0) return 0;
  const nums = variants
    .map((v) => Number(v?.volumeLiters))
    .filter(Number.isFinite);
  return nums.length ? Math.min(...nums) : 0;
}

/**
 * Максимальный объём среди вариантов (для проверки покрытия расчётного бака).
 * @param {import('./types').WaterHeaterCatalogItemNormalized | Record<string, unknown> | null | undefined} item
 * @returns {number}
 */
export function waterHeaterMaxVolumeLiters(item) {
  const variants = /** @type {{ volumeLiters?: unknown }[]} */ (
    /** @type {Record<string, unknown>} */ (item ?? {}).variants ?? []
  );
  if (!Array.isArray(variants) || variants.length === 0) return 0;
  const nums = variants
    .map((v) => Number(v?.volumeLiters))
    .filter(Number.isFinite);
  return nums.length ? Math.max(...nums) : 0;
}

/**
 * Компаратор котлов по максимальной мощности (возрастание).
 * Нужен для “первый, кто перекрывает requiredKw”.
 * @param {BoilerCatalogItem | null | undefined} a
 * @param {BoilerCatalogItem | null | undefined} b
 * @returns {number}
 */
export function compareBoilersByMaxPowerAsc(a, b) {
  return asNumber(a?.powerKw?.max, 0) - asNumber(b?.powerKw?.max, 0);
}

/**
 * Компаратор водонагревателей по минимальному объёму (возрастание).
 * Нужен для “самый маленький, который перекрывает требуемый объём”.
 * @param {WaterHeaterCatalogItemNormalized | null | undefined} a
 * @param {WaterHeaterCatalogItemNormalized | null | undefined} b
 * @returns {number}
 */
export function compareWaterHeatersByMinVolumeAsc(a, b) {
  return waterHeaterMinVolumeLiters(a) - waterHeaterMinVolumeLiters(b);
}
