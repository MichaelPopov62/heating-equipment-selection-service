/**
 * Назначение: заголовки ответа без кэширования для справочников UI.
 * Описание: no-store для GET /api/v1/presets/* — после seed/деплоя фронт не держит устаревший JSON.
 */

/**
 * @param {import('express').Response} res
 */
export function setNoStoreCacheHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}
