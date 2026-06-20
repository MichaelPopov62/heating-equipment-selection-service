/**
 * Назначение: type guard для JSON-подобных объектов.
 * Описание: Проверка «простой объект» (не null, не массив). Общий хелпер для validate.js,
 * validateCatalog.js и projects/*.
 */

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
