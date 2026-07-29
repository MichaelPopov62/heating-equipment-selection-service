/**
 * Назначение: admin API управления users (Фаза 2) — role/subscription.
 */

import express from 'express';
import { requireAuth } from '../auth/requireAuth.js';
import { requireRole } from '../auth/requireRole.js';
import { userDocumentToAuthUser } from '../auth/resolveUser.js';
import { serializeMeUser } from '../auth/serializeMeUser.js';
import { User } from '../models/public.js';
import { parseObjectIdParam } from '../projects/parseObjectId.js';
import { requireMongoForProjects } from '../projects/requireMongo.js';
import { validateAdminUserPatchBody } from './validateAdminUserPatch.js';
import { logger } from '../utils/logger.js';
import { createAdminFeedbackRouter } from './adminFeedbackRoutes.js';

/**
 * @param {import('express').Request} req
 * @returns {{ requestId: string } | null}
 */
function reqLogMeta(req) {
  return req.requestId ? { requestId: req.requestId } : null;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function asRouteParam(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

/**
 * @param {import('express').Request} _req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 */
async function mongoMiddleware(_req, _res, next) {
  try {
    await requireMongoForProjects();
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * @returns {import('express').Router}
 */
export function createAdminRouter() {
  const router = express.Router();

  router.use('/api/v1/admin', mongoMiddleware, requireAuth, requireRole('admin'));
  router.use(createAdminFeedbackRouter());

  /**
   * @param {import('express').Request<{ id: string }, import('../types/auth.js').AdminUserPatchResponse, import('../types/auth.js').AdminUserPatchBody>} req
   * @param {import('express').Response<import('../types/auth.js').AdminUserPatchResponse | import('../types/shared-types.js').ErrorEnvelope>} res
   * @param {import('express').NextFunction} next
   */
  router.patch('/api/v1/admin/users/:id', async (req, res, next) => {
    try {
      const userId = parseObjectIdParam(asRouteParam(req.params.id));
      if (!userId) {
        res.status(400).json({
          ok: false,
          error: {
            message: 'Некоректний id користувача',
            code: 'VALIDATION_FAILED',
            statusCode: 400,
          },
        });
        return;
      }

      const patch = validateAdminUserPatchBody(req.body);
      /** @type {Record<string, unknown>} */
      const update = {};
      if (patch.role !== undefined) update.role = patch.role;
      if (patch.subscription !== undefined) update.subscription = patch.subscription;

      const updated = await User.findByIdAndUpdate(userId, { $set: update }, {
        new: true,
        runValidators: true,
      });

      if (!updated) {
        res.status(404).json({
          ok: false,
          error: {
            message: 'Користувача не знайдено',
            code: 'USER_NOT_FOUND',
            statusCode: 404,
          },
        });
        return;
      }

      const authUser = userDocumentToAuthUser(updated);
      logger.info('admin.user.patch', reqLogMeta(req), {
        targetUserId: authUser.id,
        role: authUser.role,
        subscription: authUser.subscription,
        actorUserId: req.user?.id,
      });

      res.status(200).json({
        ok: true,
        user: serializeMeUser(authUser),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
