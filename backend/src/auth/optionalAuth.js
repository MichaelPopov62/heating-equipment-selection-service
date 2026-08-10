/**
 * Назначение: опциональная JWT-аутентификация (req.user при валидном Bearer JWT).
 */

import { isProjectsAuthRequired } from './projectsAuthConfig.js';
import { attachRequestContext } from './attachRequestContext.js';
import { extractBearerToken } from './extractBearerToken.js';
import { mapAuthErrorToResponse } from './authErrors.js';
import { runAuthPipeline } from './runAuthPipeline.js';
import { logger } from '../utils/logger.js';

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
export async function optionalAuth(req, _res, next) {
  if (!isProjectsAuthRequired()) {
    next();
    return;
  }

  const token = extractBearerToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const user = await runAuthPipeline(token);
    attachRequestContext(req, user);
    next();
  } catch (err) {
    // Трасування без зміни семантики: невалідний/збійний токен → гість
    const mapped = mapAuthErrorToResponse(err);
    /** @type {{ requestId?: string } | null} */
    const logMeta = req.requestId ? { requestId: req.requestId } : null;
    logger.warn('auth.optional.ignored', logMeta, {
      statusCode: mapped.statusCode,
      code: mapped.code,
      message: err instanceof Error ? err.message : String(err),
    });
    next();
  }
}
