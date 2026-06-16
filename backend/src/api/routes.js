/**
 * Назначение: основной HTTP-роутер API.
 * Описание: Создаёт Express-роутер с эндпоинтами MVP: health-check, каталог, пресеты ограждений и ТП, расчёт POST /api/v1/calc. Подключает роутер проектов и делегирует валидацию анкеты и сборку отчёта в validate.js и report/public.js. Экспортирует createRoutes().
 */

import express from 'express';
import { buildReport } from '../report/public.js';
import { getReferenceBundle } from '../reference/public.js';
import { FLOORING_FINISH_MATERIALS } from '../data/flooringFinishMaterials.js';
import { UNDERFLOOR_HEATING_BASE_PRESETS } from '../data/warmFloorAssemblyPresets.js';
import { ENVELOPE_PRESETS } from '../logic/envelopePresets.js';
import { validateAndNormalizeInput } from './validate.js';
import { logger } from '../utils/logger.js';
import { createProjectsRouter } from './projectsRoutes.js';

/**
 * @returns {Promise<import('express').Router>}
 */
export async function createRoutes() {
  const router = express.Router();

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response<import('../types/shared-types').HealthOkResponse>} res
   */
  router.get('/health', (req, res) => res.status(200).json({ ok: true, status: 'up' }));

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response<import('../types/shared-types').CatalogResponse>} res
   */
  router.get('/api/v1/catalog', async (req, res, next) => {
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
   * @param {import('express').Request} req
   * @param {import('express').Response<import('../types/shared-types').EnvelopePresetsResponse>} res
   */
  router.get('/api/v1/presets/envelope', (req, res) => {
    // Не кешируем справочник на стороне браузера/прокси.
    // Иначе UI может долго видеть старый набор пресетов (304) и "не менять" варианты.
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).json({ ok: true, presets: ENVELOPE_PRESETS });
  });

  const ufhPresetCacheHeaders = (res) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  };

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response<import('../types/shared-types').UnderfloorHeatingBasesResponse>} res
   */
  router.get('/api/v1/presets/underfloor-heating/bases', (req, res) => {
    ufhPresetCacheHeaders(res);
    res.status(200).json({ ok: true, bases: UNDERFLOOR_HEATING_BASE_PRESETS });
  });

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response<import('../types/shared-types').FlooringFinishesResponse>} res
   */
  router.get('/api/v1/presets/flooring-finishes', (req, res) => {
    ufhPresetCacheHeaders(res);
    res.status(200).json({ ok: true, finishes: FLOORING_FINISH_MATERIALS });
  });

  /**
   * Сводный ответ: базы + финиши (для одного запроса UI).
   *
   * @param {import('express').Request} req
   * @param {import('express').Response<import('../types/shared-types').UnderfloorHeatingPresetsBundleResponse>} res
   */
  router.get('/api/v1/presets/underfloor-heating', (req, res) => {
    ufhPresetCacheHeaders(res);
    res.status(200).json({
      ok: true,
      bases: UNDERFLOOR_HEATING_BASE_PRESETS,
      finishes: FLOORING_FINISH_MATERIALS,
    });
  });

  /**
   * Режимы ТП с человекочитаемым UI (Mongo underfloor_heating_presets).
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  router.get('/api/v1/presets/underfloor-heating/modes', async (req, res, next) => {
    try {
      ufhPresetCacheHeaders(res);
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
   * @param {import('express').Request<{}, import('../types/shared-types').CalcOkResponse, import('../types/shared-types').CalcRequestBody>} req
   * @param {import('express').Response<import('../types/shared-types').CalcOkResponse>} res
   * @param {import('express').NextFunction} next
   * @returns {Promise<void>}
   */
  router.use(createProjectsRouter());

  router.post('/api/v1/calc', async (req, res, next) => {
    const requestId = req.requestId ?? null;
    try {
      logger.debug('calc.request.start', { requestId });
      const bundle = await getReferenceBundle();
      const input = validateAndNormalizeInput(req.body);
      const report = await buildReport({
        input,
        catalog: bundle.catalog,
        catalogSource: bundle.catalogSource,
        waterNorms: bundle.waterNorms,
        waterNormsSource: bundle.waterNormsSource,
        appliances: bundle.appliances,
        appliancesSource: bundle.appliancesSource,
        referenceBundleLoadedAt: bundle.loadedAt,
        recommendationsSource: bundle.recommendationsSource,
        ufhPresetsSource: bundle.ufhPresetsSource,
        ufhPresetsSchemaVersion: bundle.ufhPresets.schemaVersion,
      });
      logger.debug('calc.request.done', { requestId }, { warnings: report?.warnings?.length ?? 0 });
      res.status(200).json({ ok: true, report });
    } catch (err) {
      next(err);
    }
  });

  // 404 для всіх інших маршрутів (у форматі ErrorEnvelope, як і раніше)
  /**
   * @param {import('express').Request} req
   * @param {import('express').Response<import('../types/shared-types').ErrorEnvelope>} res
   */
  router.use((req, res) =>
    res.status(404).json({ ok: false, error: { message: 'Не найдено', code: 'NOT_FOUND', statusCode: 404 } }),
  );

  return router;
}
