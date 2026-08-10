/**
 * Назначение: единая сборка HTTP ErrorEnvelope для early-return в роутах/middleware.
 * Описание: Гарантирует { ok: false, error: { message, code, statusCode, details? } }.
 * Не логирует — для throw-пути остаётся handleApiError в index.js.
 */

/**
 * @param {import('express').Response} res
 * @param {{
 *   statusCode: number,
 *   message: string,
 *   code: string,
 *   details?: import('../types/shared-types.js').ErrorDetailsAjvItem[],
 * }} opts
 * @returns {void}
 */
export function sendErrorEnvelope(res, { statusCode, message, code, details }) {
  /** @type {import('../types/shared-types.js').ErrorEnvelope['error']} */
  const error = { message, code, statusCode };
  if (details !== undefined) {
    error.details = details;
  }
  res.status(statusCode).json({ ok: false, error });
}
