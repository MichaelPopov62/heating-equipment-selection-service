/**
 * Назначение: GET /api/v1/me — профиль текущего пользователя (Фаза 2).
 */

import express from 'express';
import { optionalAuth } from '../auth/optionalAuth.js';
import { isProjectsAuthRequired } from '../auth/projectsAuthConfig.js';
import { buildDevMeUser, serializeMeUser } from '../auth/serializeMeUser.js';
import { sendErrorEnvelope } from './sendErrorEnvelope.js';

/**
 * @returns {import('express').Router}
 */
export function createMeRouter() {
  const router = express.Router();

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response<import('../types/auth.js').MeOkResponse | import('../types/shared-types.js').ErrorEnvelope>} res
   * @param {import('express').NextFunction} next
   */
  router.get('/api/v1/me', optionalAuth, async (req, res, next) => {
    try {
      if (req.user) {
        res.status(200).json({
          ok: true,
          user: serializeMeUser(req.user),
        });
        return;
      }

      if (!isProjectsAuthRequired()) {
        res.status(200).json({
          ok: true,
          user: buildDevMeUser(),
        });
        return;
      }

      sendErrorEnvelope(res, { statusCode: 401, message: 'Потрібен Authorization: Bearer <JWT>', code: 'PROJECTS_AUTH_REQUIRED' });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
