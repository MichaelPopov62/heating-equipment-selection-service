/**
 * Назначение: базовая санитизация строк входа API и каталога.
 * Описание: Trim и удаление угловых скобок (< >); единое поведение для validate.js и validateCatalog.js.
 */

/**
 * @param {unknown} v
 * @returns {string}
 */
export function sanitizeTrimAngleBrackets(v) {
  return String(v ?? '').trim().replace(/[<>]/g, '');
}
