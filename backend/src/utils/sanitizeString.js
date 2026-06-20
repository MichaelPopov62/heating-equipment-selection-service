/**
 * Назначение: базовая санитизация строк входа API и каталога.
 * Описание: Trim и удаление угловых скобок (< >); единое поведение для validate.js,
 * validateCatalog.js и projects/validateProjectBody.js.
 */

/**
 * @param {unknown} v
 * @returns {string}
 */
export function sanitizeTrimAngleBrackets(v) {
  return String(v ?? '').trim().replace(/[<>]/g, '');
}
