/**
 * Назначение: публичный read-only API снимков сметы по shareToken.
 * Описание: GET без JWT; только whitelist snapshot; rate limit по IP.
 */

import express from 'express';
import { Project } from '../models/public.js';
import { publicShareReadRateLimiter } from './middleware/rateLimiters.js';
import { requireMongoForProjects } from '../projects/requireMongo.js';
import { normalizeShareTokenParam } from '../projects/shareToken.js';
import { serializePublicShare } from '../projects/serializeShare.js';
import { parseIncludeTechnicalQuery } from '../projects/parseIncludeTechnicalQuery.js';
import { renderEstimatePdf } from '../projects/renderEstimatePdf.js';
import { isPlainObject } from '../utils/isPlainObject.js';
import { logger } from '../utils/logger.js';

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
 * @returns {import('express').Router}
 */
export function createPublicSharesRouter() {
  const router = express.Router();

  /**
   * @param {import('express').Request<{ shareToken: string }>} req
   * @param {import('express').Response<import('../types/shared-types.js').PublicShareResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.get(
    '/api/v1/public/shares/:shareToken',
    mongoMiddleware,
    publicShareReadRateLimiter,
    async (req, res, next) => {
      try {
        const token = normalizeShareTokenParam(asRouteParam(req.params.shareToken));
        if (!token) {
          res.status(404).json({
            ok: false,
            error: { message: 'Ссылка не найдена', code: 'SHARE_NOT_FOUND', statusCode: 404 },
          });
          return;
        }

        const doc = await Project.findOne({ shareToken: token })
          .select({
            shareToken: 1,
            shareSnapshot: 1,
            sharePublishedAt: 1,
          })
          .lean();

        const snapshot = doc && isPlainObject(doc.shareSnapshot) ? doc.shareSnapshot : null;
        if (!doc || !snapshot || typeof snapshot.clientName !== 'string') {
          res.status(404).json({
            ok: false,
            error: { message: 'Ссылка не найдена', code: 'SHARE_NOT_FOUND', statusCode: 404 },
          });
          return;
        }

        const typed = /** @type {import('../types/shared-types.js').ProjectShareSnapshot} */ (
          /** @type {unknown} */ (snapshot)
        );

        logger.info('share.public.get', reqLogMeta(req), {
          tokenPrefix: token.slice(0, 6),
        });

        res.status(200).json({
          ok: true,
          share: serializePublicShare(typed, token),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * Скачать PDF публичной сметы (без JWT). Только shareSnapshot.
   *
   * @param {import('express').Request<{ shareToken: string }>} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  router.get(
    '/api/v1/public/shares/:shareToken/pdf',
    mongoMiddleware,
    publicShareReadRateLimiter,
    async (req, res, next) => {
      try {
        const token = normalizeShareTokenParam(asRouteParam(req.params.shareToken));
        if (!token) {
          res.status(404).json({
            ok: false,
            error: { message: 'Ссылка не найдена', code: 'SHARE_NOT_FOUND', statusCode: 404 },
          });
          return;
        }

        const doc = await Project.findOne({ shareToken: token })
          .select({
            shareToken: 1,
            shareSnapshot: 1,
            sharePublishedAt: 1,
          })
          .lean();

        const snapshot = doc && isPlainObject(doc.shareSnapshot) ? doc.shareSnapshot : null;
        if (!doc || !snapshot || typeof snapshot.clientName !== 'string') {
          res.status(404).json({
            ok: false,
            error: { message: 'Ссылка не найдена', code: 'SHARE_NOT_FOUND', statusCode: 404 },
          });
          return;
        }

        if (!isPlainObject(snapshot.commercial)) {
          res.status(400).json({
            ok: false,
            error: {
              message: 'В снимке нет финансовой сметы',
              code: 'PDF_COMMERCIAL_REQUIRED',
              statusCode: 400,
            },
          });
          return;
        }

        const includeTechnical = parseIncludeTechnicalQuery(req.query.includeTechnical);
        const typed = /** @type {import('../types/shared-types.js').ProjectShareSnapshot} */ (
          /** @type {unknown} */ (snapshot)
        );

        const started = Date.now();
        const pdf = await renderEstimatePdf(typed, { includeTechnical });
        logger.info('share.public.pdf', reqLogMeta(req), {
          tokenPrefix: token.slice(0, 6),
          includeTechnical,
          bytes: pdf.bytes,
          ms: Date.now() - started,
        });

        res.status(200);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', pdf.contentDisposition);
        res.setHeader('Content-Length', String(pdf.bytes));
        res.send(pdf.buffer);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
