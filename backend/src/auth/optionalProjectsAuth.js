/**
 * Назначение: опциональная JWT-аутентификация (sub в req.projectsUser при наличии токена).
 */

import { isProjectsAuthRequired, resolveProjectsDevOwnerId } from './projectsAuthConfig.js';
import { verifyAccessToken } from './verifyAccessToken.js';

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
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
export async function optionalProjectsAuth(req, _res, next) {
  if (!isProjectsAuthRequired()) {
    req.projectsUser = { sub: resolveProjectsDevOwnerId() };
    next();
    return;
  }

  const token = extractBearerToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    req.projectsUser = await verifyAccessToken(token);
    next();
  } catch {
    next();
  }
}
