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
  let message = 'Недійсний або прострочений токен';
  if (statusCode === 503 && code === 'PROJECTS_AUTH_NOT_CONFIGURED') {
    message = 'Аутентифікація проєктів не налаштована на сервері';
  } else if (code === 'MONGODB_UNAVAILABLE') {
    message = 'Не вдалося підключитися до MongoDB.';
  } else if (err instanceof Error && err.message) {
    message = err.message;
  }

  return { statusCode, code, message };
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response<import('../types/shared-types.js').ErrorEnvelope>} res
 * @param {{ statusCode?: number; code?: string; message?: string } | unknown} err
 * @returns {void}
 */
export function respondAuthorizationError(req, res, err) {
  const known =
    err && typeof err === 'object'
      ? /** @type {import('../types/shared-types.js').AppErrorLike} */ (err)
      : null;
  const statusCode = known?.statusCode === 403 ? 403 : 403;
  const code =
    typeof known?.code === 'string' && known.code.length > 0
      ? known.code
      : 'AUTHORIZATION_FORBIDDEN';
  const message =
    known instanceof Error && known.message
      ? known.message
      : typeof known?.message === 'string' && known.message
        ? known.message
        : 'Доступ заборонено';

  /** @type {{ requestId?: string } | null} */
  const logMeta = req.requestId ? { requestId: req.requestId } : null;

  logger.warn('auth.authorization.failed', logMeta, {
    statusCode,
    code,
    message,
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
