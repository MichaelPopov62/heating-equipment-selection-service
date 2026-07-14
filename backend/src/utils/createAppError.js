/**
 * Назначение: фабрика HTTP-ошибок с полями AppErrorLike.
 * Описание: Единый способ задать statusCode и code для централизованного обработчика в index.js.
 */

/**
 * @param {string} message
 * @param {string} code
 * @param {number} statusCode
 * @returns {Error & import('../types/shared-types.js').AppErrorLike}
 */
export function createAppError(message, code, statusCode) {
  const err = new Error(message);
  /** @type {Error & import('../types/shared-types.js').AppErrorLike} */
  const appErr = err;
  appErr.code = code;
  appErr.statusCode = statusCode;
  return appErr;
}

/**
 * @param {string} message
 * @param {string} code
 * @param {number} statusCode
 * @returns {never}
 */
export function throwAppError(message, code, statusCode) {
  throw createAppError(message, code, statusCode);
}
