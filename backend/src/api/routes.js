/**
 * Назначение: основной HTTP-роутер API.
 * Описание: Создаёт Express-роутер с эндпоинтами MVP: health-check, каталог, пресеты ограждений и ТП, расчёт POST /api/v1/calc. Подключает роутер проектов; calc-пайплайн — runCalculation.js.
 */

import express from 'express';
import { getReferenceBundle } from '../reference/public.js';
import { FLOORING_FINISH_MATERIALS } from '../data/flooringFinishMaterials.js';
import { UNDERFLOOR_HEATING_BASE_PRESETS } from '../data/warmFloorAssemblyPresets.js';
import { ENVELOPE_PRESETS } from '../logic/envelopePresets.js';
import { runCalculation } from './runCalculation.js';
import { logger } from '../utils/logger.js';
import { setNoStoreCacheHeaders } from '../utils/setNoStoreCacheHeaders.js';
import { createProjectsRouter } from './projectsRoutes.js';
import { createPublicSharesRouter } from './publicSharesRoutes.js';
import { createSystemRouter } from './systemRoutes.js';
import { createFeedbackRouter } from './feedbackRoutes.js';
import { calcRateLimiter } from './middleware/rateLimiters.js';

/**
 * @returns {Promise<import('express').Router>}
 */
export async function createRoutes() {
  const router = express.Router();

  /**
   * @param {import('express').Request} _req
   * @param {import('express').Response<import('../types/shared-types.js').HealthOkResponse>} res
   */
  router.get('/health', (_req, res) => res.status(200).json({ ok: true, status: 'up' }));

  router.use(createSystemRouter());

  /**
   * @param {import('express').Request} _req
   * @param {import('express').Response<import('../types/shared-types.js').CatalogResponse>} res
   */
  router.get('/api/v1/catalog', async (_req, res, next) => {
    try {
      const bundle = await getReferenceBundle();
      res.status(200).json({
        ok: true,
        catalog: bundle.catalog,
        catalogSource: bundle.catalogSource,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * Справочники для анкеты: не кешировать в браузере/прокси (envelope, ТП, финиши, modes).
   *
   * @param {import('express').Request} _req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  router.use('/api/v1/presets', (_req, res, next) => {
    setNoStoreCacheHeaders(res);
    next();
  });

  /**
   * @param {import('express').Request} _req
   * @param {import('express').Response<import('../types/shared-types.js').EnvelopePresetsResponse>} res
   */
  router.get('/api/v1/presets/envelope', (_req, res) => {
    res.status(200).json({ ok: true, presets: ENVELOPE_PRESETS });
  });

  /**
   * @param {import('express').Request} _req
   * @param {import('express').Response<import('../types/shared-types.js').UnderfloorHeatingBasesResponse>} res
   */
  router.get('/api/v1/presets/underfloor-heating/bases', (_req, res) => {
    res.status(200).json({ ok: true, bases: UNDERFLOOR_HEATING_BASE_PRESETS });
  });

  /**
   * @param {import('express').Request} _req
   * @param {import('express').Response<import('../types/shared-types.js').FlooringFinishesResponse>} res
   */
  router.get('/api/v1/presets/flooring-finishes', (_req, res) => {
    res.status(200).json({ ok: true, finishes: FLOORING_FINISH_MATERIALS });
  });

  /**
   * Сводный ответ: базы + финиши (для одного запроса UI).
   *
   * @param {import('express').Request} _req
   * @param {import('express').Response<import('../types/shared-types.js').UnderfloorHeatingPresetsBundleResponse>} res
   */
  router.get('/api/v1/presets/underfloor-heating', (_req, res) => {
    res.status(200).json({
      ok: true,
      bases: UNDERFLOOR_HEATING_BASE_PRESETS,
      finishes: FLOORING_FINISH_MATERIALS,
    });
  });

  /**
   * Режимы ТП с человекочитаемым UI (Mongo underfloor_heating_presets).
   *
   * @param {import('express').Request} _req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  router.get('/api/v1/presets/underfloor-heating/modes', async (_req, res, next) => {
    try {
      const bundle = await getReferenceBundle();
      res.status(200).json({
        ok: true,
        schemaVersion: bundle.ufhPresets.schemaVersion,
        source: bundle.ufhPresetsSource,
        presets: bundle.ufhPresets.presets.map((p) => ({
          presetId: p.presetId,
          ui: p.ui,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * @param {import('express').Request<{}, import('../types/shared-types.js').CalcOkResponse, import('../types/shared-types.js').CalcRequestBody>} req
   * @param {import('express').Response<import('../types/shared-types.js').CalcOkResponse>} res
   * @param {import('express').NextFunction} next
   * @returns {Promise<void>}
   */
  router.use(createProjectsRouter());
  router.use(createPublicSharesRouter());
  router.use(createFeedbackRouter());

  router.post('/api/v1/calc', calcRateLimiter, async (req, res, next) => {
    const logMeta = req.requestId ? { requestId: req.requestId } : null;
    try {
      logger.debug('calc.request.start', logMeta);
      const { report } = await runCalculation(req.body);
      logger.debug('calc.request.done', logMeta, { warnings: report?.warnings?.length ?? 0 });
      res.status(200).json({ ok: true, report });
    } catch (err) {
      next(err);
    }
  });

  // 404 для всіх інших маршрутів (у форматі ErrorEnvelope, як і раніше)
  /**
   * @param {import('express').Request} _req
   * @param {import('express').Response<import('../types/shared-types.js').ErrorEnvelope>} res
   */
  router.use((_req, res) =>
    res.status(404).json({ ok: false, error: { message: 'Не найдено', code: 'NOT_FOUND', statusCode: 404 } }),
  );

  return router;
}
