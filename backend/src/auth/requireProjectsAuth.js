/**
 * Назначение: middleware аутентификации для /api/v1/projects.
 * Описание: Production — Bearer JWT; dev — dev-local owner без токена (или PROJECTS_AUTH_ENABLED).
 */

import {
  isProjectsAuthRequired,
  resolveProjectsDevOwnerId,
} from './projectsAuthConfig.js';
import { verifyAccessToken } from './verifyAccessToken.js';
import { logger } from '../utils/logger.js';

/**
 * @param {import('express').Request} req
 * @returns {string | null}
 */
function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response<import('../types/shared-types.js').ErrorEnvelope>} res
 * @param {import('express').NextFunction} next
 */
export async function requireProjectsAuth(req, res, next) {
  if (!isProjectsAuthRequired()) {
    req.projectsUser = { sub: resolveProjectsDevOwnerId() };
    next();
    return;
  }

  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({
      ok: false,
      error: {
        message: 'Требуется Authorization: Bearer <JWT>',
        code: 'PROJECTS_AUTH_REQUIRED',
        statusCode: 401,
      },
    });
    return;
  }

  try {
    req.projectsUser = await verifyAccessToken(token);
    next();
  } catch (err) {
    const known = err && typeof err === 'object' ? /** @type {import('../types/shared-types.js').AppErrorLike} */ (err) : null;
    const statusCode = known?.statusCode === 503 ? 503 : 403;
    const code =
      known?.code === 'PROJECTS_AUTH_NOT_CONFIGURED'
        ? 'PROJECTS_AUTH_NOT_CONFIGURED'
        : 'PROJECTS_AUTH_FORBIDDEN';

    /** @type {{ requestId?: string } | null} */
    const logMeta = req.requestId ? { requestId: req.requestId } : null;

    logger.warn('projects.auth.failed', logMeta, {
      statusCode,
      code,
      message: err instanceof Error ? err.message : String(err),
    });

    res.status(statusCode).json({
      ok: false,
      error: {
        message:
          statusCode === 503
            ? 'Аутентификация проектов не настроена на сервере'
            : 'Недействительный или просроченный токен',
        code,
        statusCode,
      },
    });
  }
}
