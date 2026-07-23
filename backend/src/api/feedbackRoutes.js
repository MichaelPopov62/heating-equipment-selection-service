/**
 * Назначение: HTTP-роут feedback (bug/contact) для prod SaaS UI.
 */

import express from 'express';

import { optionalAuth } from '../auth/optionalAuth.js';
import { validateFeedbackBody } from '../feedback/validateFeedbackBody.js';
import { feedbackRateLimiter } from './middleware/rateLimiters.js';
import { Feedback } from '../models/Feedback.js';
import { requireMongoForProjects } from '../projects/requireMongo.js';
import { logger } from '../utils/logger.js';

/**
 * @returns {import('express').Router}
 */
export function createFeedbackRouter() {
  const router = express.Router();

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  router.post('/api/v1/feedback', feedbackRateLimiter, optionalAuth, async (req, res, next) => {
    const logMeta = req.requestId ? { requestId: req.requestId } : null;
    try {
      const parsed = validateFeedbackBody(req.body);
      if (!parsed.ok) {
        res.status(400).json({
          ok: false,
          error: {
            message: parsed.message,
            code: parsed.code,
            statusCode: 400,
          },
        });
        return;
      }

      await requireMongoForProjects();

      /** @type {Record<string, unknown>} */
      const docPayload = { ...parsed.data };
      if (req.user?.id) docPayload.ownerSub = req.user.id;
      const clientIp = typeof req.ip === 'string' ? req.ip.slice(0, 64) : '';
      if (clientIp) docPayload.clientIp = clientIp;

      const doc = await Feedback.create(docPayload);

      const id = String(doc._id);

      logger.info('feedback.created', logMeta, {
        id,
        type: parsed.data.type,
        hasEmail: Boolean(parsed.data.email),
      });

      res.status(201).json({ ok: true, id });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
