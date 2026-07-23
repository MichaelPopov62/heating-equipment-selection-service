/**
 * Назначение: общая обработка ошибок auth middleware.
 */

import { logger } from '../utils/logger.js';

/**
 * @param {unknown} err
 * @returns {{ statusCode: number, code: string, message: string }}
 */
export function mapAuthErrorToResponse(err) {
  const known = err && typeof err === 'object' ? /** @type {import('../types/shared-types.js').AppErrorLike} */ (err) : null;
  const statusCode =
    known?.statusCode === 503 ? 503 : known?.statusCode === 401 ? 401 : 403;

  /** @type {string} */
  let code = 'PROJECTS_AUTH_FORBIDDEN';
  if (known?.code === 'PROJECTS_AUTH_NOT_CONFIGURED') {
    code = 'PROJECTS_AUTH_NOT_CONFIGURED';
  } else if (known?.code === 'MONGODB_UNAVAILABLE') {
    code = 'MONGODB_UNAVAILABLE';
  } else if (known?.code) {
    code = known.code;
  }

  /** @type {string} */
  let message = 'Недействительный или просроченный токен';
  if (statusCode === 503 && code === 'PROJECTS_AUTH_NOT_CONFIGURED') {
    message = 'Аутентификация проектов не настроена на сервере';
  } else if (code === 'MONGODB_UNAVAILABLE') {
    message = 'Не удалось подключиться к MongoDB.';
  } else if (err instanceof Error && err.message && code === 'PROJECTS_AUTH_FORBIDDEN') {
    message = err.message;
  }

  return { statusCode, code, message };
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response<import('../types/shared-types.js').ErrorEnvelope>} res
 * @param {unknown} err
 * @returns {void}
 */
export function respondAuthError(req, res, err) {
  const { statusCode, code, message } = mapAuthErrorToResponse(err);

  /** @type {{ requestId?: string } | null} */
  const logMeta = req.requestId ? { requestId: req.requestId } : null;

  logger.warn('auth.failed', logMeta, {
    statusCode,
    code,
    message: err instanceof Error ? err.message : String(err),
  });

  res.status(statusCode).json({
    ok: false,
    error: {
      message,
      code,
      statusCode,
    },
  });
}
