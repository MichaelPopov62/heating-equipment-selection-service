/**
 * Назначение: системные HTTP-эндпоинты (инвалидация справочного кэша).
 * Описание: Защищены SYSTEM_INTERNAL_TOKEN; не для публичного UI.
 */

import express from 'express';
import { invalidateAndWarmReferenceCache } from '../reference/public.js';
import { logger } from '../utils/logger.js';

/**
 * @returns {import('express').Router}
 */
export function createSystemRouter() {
  const router = express.Router();

  /**
   * POST /api/v1/system/invalidate-reference-cache
   * Сброс TTL-снимка bundle и немедленная перезагрузка из Mongo/file.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response<
   *   import('../types/shared-types.js').InvalidateReferenceCacheOkResponse
   *   | import('../types/shared-types.js').ErrorEnvelope
   * >} res
   * @param {import('express').NextFunction} next
   */
  router.post('/api/v1/system/invalidate-reference-cache', async (req, res, next) => {
    const logMeta = req.requestId ? { requestId: req.requestId } : null;
    try {
      const configured = process.env.SYSTEM_INTERNAL_TOKEN?.trim();
      if (!configured) {
        res.status(503).json({
          ok: false,
          error: {
            message:
              'SYSTEM_INTERNAL_TOKEN не задан на сервере — инвалидация кэша недоступна.',
            code: 'SYSTEM_TOKEN_NOT_CONFIGURED',
            statusCode: 503,
          },
        });
        return;
      }

      const headerToken = req.headers['x-system-token'];
      const token = typeof headerToken === 'string' ? headerToken.trim() : '';
      if (token !== configured) {
        logger.warn('referenceCache.invalidate.forbidden', logMeta);
        res.status(403).json({
          ok: false,
          error: {
            message: 'Неверный или отсутствующий X-System-Token.',
            code: 'SYSTEM_TOKEN_FORBIDDEN',
            statusCode: 403,
          },
        });
        return;
      }

      logger.info('referenceCache.invalidate.request', logMeta);
      const bundle = await invalidateAndWarmReferenceCache();

      res.status(200).json({
        ok: true,
        referenceBundleLoadedAt: bundle.loadedAt,
        catalogSource: bundle.catalogSource,
        waterNormsSource: bundle.waterNormsSource,
        appliancesSource: bundle.appliancesSource,
        recommendationsSource: bundle.recommendationsSource,
        ufhPresetsSource: bundle.ufhPresetsSource,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
