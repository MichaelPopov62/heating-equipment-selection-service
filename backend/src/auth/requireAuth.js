/**
 * Назначение: обязательная JWT-аутентификация для protected API.
 * Описание: verifyAccessToken → mapJwtPayload → resolveUser → attachRequestContext → req.user.
 */

import { isProjectsAuthRequired } from './projectsAuthConfig.js';
import { attachRequestContext } from './attachRequestContext.js';
import { extractBearerToken } from './extractBearerToken.js';
import { respondAuthError } from './authErrors.js';
import { runAuthPipeline } from './runAuthPipeline.js';
import { sendErrorEnvelope } from '../api/sendErrorEnvelope.js';

/**
 * @param {import('express').Request} req
 * @param {import('express').Response<import('../types/shared-types.js').ErrorEnvelope>} res
 * @param {import('express').NextFunction} next
 */
export async function requireAuth(req, res, next) {
  if (!isProjectsAuthRequired()) {
    next();
    return;
  }

  const token = extractBearerToken(req);
  if (!token) {
    sendErrorEnvelope(res, { statusCode: 401, message: 'Потрібен Authorization: Bearer <JWT>', code: 'PROJECTS_AUTH_REQUIRED' });
    return;
  }

  try {
    const user = await runAuthPipeline(token);
    attachRequestContext(req, user);
    next();
  } catch (err) {
    respondAuthError(req, res, err);
  }
}
