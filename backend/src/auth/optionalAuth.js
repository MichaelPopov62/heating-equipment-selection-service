/**
 * Назначение: опциональная JWT-аутентификация (req.user при валидном Bearer JWT).
 */

import { isProjectsAuthRequired } from './projectsAuthConfig.js';
import { attachRequestContext } from './attachRequestContext.js';
import { extractBearerToken } from './extractBearerToken.js';
import { runAuthPipeline } from './runAuthPipeline.js';

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
  } catch {
    next();
  }
}
