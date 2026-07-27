/**
 * Назначение: middleware authorization gate по req.user.role (Фаза 2).
 */

import { hasRole } from './authorizationPolicy.js';
import { isProjectsAuthRequired } from './projectsAuthConfig.js';
import { respondAuthorizationError } from './authErrors.js';

/**
 * @param {...import('../types/auth.js').UserRole} allowedRoles
 * @returns {import('express').RequestHandler}
 */
export function requireRole(...allowedRoles) {
  /**
   * @param {import('express').Request} req
   * @param {import('express').Response<import('../types/shared-types.js').ErrorEnvelope>} res
   * @param {import('express').NextFunction} next
   */
  return (req, res, next) => {
    if (!isProjectsAuthRequired()) {
      respondAuthorizationError(req, res, {
        statusCode: 403,
        code: 'ADMIN_REQUIRED',
        message: 'Admin API недоступний без увімкненої JWT-аутентифікації',
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        ok: false,
        error: {
          message: 'Потрібен Authorization: Bearer <JWT>',
          code: 'PROJECTS_AUTH_REQUIRED',
          statusCode: 401,
        },
      });
      return;
    }

    try {
      if (!hasRole(req.user, ...allowedRoles)) {
        respondAuthorizationError(req, res, {
          statusCode: 403,
          code: 'ADMIN_REQUIRED',
          message: 'Недостатньо прав (потрібна role=admin)',
        });
        return;
      }
      next();
    } catch (err) {
      respondAuthorizationError(req, res, err);
    }
  };
}
