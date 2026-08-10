/**
 * Назначение: admin API списка, статусов и SSE-событий feedback.
 */

import express from 'express';

import {
  buildFeedbackStatusUpdate,
  encodeFeedbackCursor,
  parseAdminFeedbackListQuery,
  parseAdminFeedbackPatchBody,
  serializeAdminFeedback,
} from '../feedback/adminFeedback.js';
import { subscribeFeedbackEvents } from '../feedback/feedbackEventHub.js';
import { Feedback } from '../models/public.js';
import { parseObjectIdParam } from '../projects/parseObjectId.js';
import { logger } from '../utils/logger.js';
import { ERROR_CODES } from './errorCodes.js';
import { sendErrorEnvelope } from './sendErrorEnvelope.js';

const SSE_HEARTBEAT_INTERVAL_MS = 25_000;

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
 * @param {import('express').Response<import('../types/shared-types.js').ErrorEnvelope>} res
 * @param {string} message
 * @returns {void}
 */
function respondValidationError(res, message) {
  sendErrorEnvelope(res, {
    statusCode: 400,
    message,
    code: ERROR_CODES.VALIDATION_ERROR,
  });
}

/**
 * @returns {import('express').Router}
 */
export function createAdminFeedbackRouter() {
  const router = express.Router();

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response<import('../types/shared-types.js').AdminFeedbackListResponse | import('../types/shared-types.js').ErrorEnvelope>} res
   * @param {import('express').NextFunction} next
   */
  router.get('/api/v1/admin/feedback', async (req, res, next) => {
    try {
      const parsed = parseAdminFeedbackListQuery(req.query);
      if (!parsed.ok) {
        respondValidationError(res, parsed.message);
        return;
      }

      /** @type {import('mongoose').QueryFilter<import('../types/shared-types.js').FeedbackMongoDoc>} */
      const filter = {};
      /** @type {import('mongoose').QueryFilter<import('../types/shared-types.js').FeedbackMongoDoc>[]} */
      const conditions = [];
      if (parsed.value.status === 'new') {
        conditions.push({
          $or: [
            { status: 'new' },
            { status: { $exists: false } },
          ],
        });
      } else if (parsed.value.status) {
        filter.status = parsed.value.status;
      }
      if (parsed.value.type) filter.type = parsed.value.type;
      if (parsed.value.cursor) {
        conditions.push({
          $or: [
            { createdAt: { $lt: parsed.value.cursor.createdAt } },
            {
              createdAt: parsed.value.cursor.createdAt,
              _id: { $lt: parsed.value.cursor.id },
            },
          ],
        });
      }
      if (conditions.length > 0) filter.$and = conditions;

      const docs = /** @type {import('../types/shared-types.js').FeedbackMongoDoc[]} */ (
        await Feedback.find(filter)
          .sort({ createdAt: -1, _id: -1 })
          .limit(parsed.value.limit + 1)
          .lean()
          .exec()
      );
      const hasMore = docs.length > parsed.value.limit;
      const page = hasMore ? docs.slice(0, parsed.value.limit) : docs;
      const last = page.at(-1);
      const nextCursor =
        hasMore && last?._id && last.createdAt
          ? encodeFeedbackCursor({ createdAt: last.createdAt, id: last._id })
          : null;

      res.status(200).json({
        ok: true,
        items: page.map(serializeAdminFeedback),
        nextCursor,
        limit: parsed.value.limit,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * Маршрут объявлен до `/:id`, чтобы `stream` не интерпретировался как ObjectId.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  router.get('/api/v1/admin/feedback/stream', (req, res) => {
    res.status(200);
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write(': connected\n\n');

    const unsubscribe = subscribeFeedbackEvents((event) => {
      res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.feedback)}\n\n`);
    });
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, SSE_HEARTBEAT_INTERVAL_MS);
    heartbeat.unref();

    let closed = false;
    const cleanup = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
      logger.info('admin.feedback.stream.closed', reqLogMeta(req), {
        actorUserId: req.user?.id,
      });
    };

    req.on('close', cleanup);
    res.on('close', cleanup);
    logger.info('admin.feedback.stream.opened', reqLogMeta(req), {
      actorUserId: req.user?.id,
    });
  });

  /**
   * @param {import('express').Request<{ id: string }, import('../types/shared-types.js').AdminFeedbackPatchResponse, import('../types/shared-types.js').AdminFeedbackPatchBody>} req
   * @param {import('express').Response<import('../types/shared-types.js').AdminFeedbackPatchResponse | import('../types/shared-types.js').ErrorEnvelope>} res
   * @param {import('express').NextFunction} next
   */
  router.patch('/api/v1/admin/feedback/:id', async (req, res, next) => {
    try {
      const id = parseObjectIdParam(asRouteParam(req.params.id));
      if (!id) {
        respondValidationError(res, 'Некорректный id feedback');
        return;
      }

      const parsed = parseAdminFeedbackPatchBody(req.body);
      if (!parsed.ok) {
        respondValidationError(res, parsed.message);
        return;
      }

      const current = await Feedback.findById(id).lean().exec();
      if (!current) {
        sendErrorEnvelope(res, { statusCode: 404, message: 'Feedback не найден', code: ERROR_CODES.FEEDBACK_NOT_FOUND });
        return;
      }

      const update = buildFeedbackStatusUpdate(parsed.status, current.readAt, new Date());
      const updated = await Feedback.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
      })
        .lean()
        .exec();
      if (!updated) {
        sendErrorEnvelope(res, { statusCode: 404, message: 'Feedback не найден', code: ERROR_CODES.FEEDBACK_NOT_FOUND });
        return;
      }

      const feedback = serializeAdminFeedback(updated);
      logger.info('admin.feedback.patch', reqLogMeta(req), {
        feedbackId: feedback.id,
        status: feedback.status,
        actorUserId: req.user?.id,
      });
      res.status(200).json({ ok: true, feedback });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
