/**
 * Назначение: REST API проектов и расчётов.
 * Описание: Реализует CRUD для проектов клиента и сохранённых расчётов в MongoDB (коллекции projects, calculations). Повторно использует validateAndNormalizeInput и buildReport для пересчёта по сохранённой анкете. Экспортирует createProjectsRouter(); подключается из routes.js.
 */

import express from 'express';
import { Project, Calculation } from '../models/public.js';
import { buildReport } from '../report/public.js';
import { getReferenceBundle } from '../reference/public.js';
import { validateAndNormalizeInput } from './validate.js';
import { extractCalculationSummary } from '../projects/extractCalculationSummary.js';
import {
  validateProjectCreateBody,
  validateProjectUpdateBody,
} from '../projects/validateProjectBody.js';
import { parseObjectIdParam } from '../projects/parseObjectId.js';
import { requireMongoForProjects } from '../projects/requireMongo.js';
import {
  serializeCalculationDetail,
  serializeCalculationListItem,
  serializeProjectDetail,
  serializeProjectListItem,
} from '../projects/serializeProject.js';
import { logger } from '../utils/logger.js';

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
async function mongoMiddleware(req, res, next) {
  try {
    await requireMongoForProjects();
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * @param {unknown} raw
 * @param {number} fallback
 * @param {number} max
 */
function parseLimit(raw, fallback, max) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(Math.floor(n), max);
}

/**
 * @returns {import('express').Router}
 */
export function createProjectsRouter() {
  const router = express.Router();

  router.use('/api/v1/projects', mongoMiddleware);

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response<import('../types/shared-types').ProjectsListResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.get('/api/v1/projects', async (req, res, next) => {
    try {
      const limit = parseLimit(req.query.limit, 50, 100);
      const skip = parseLimit(req.query.skip, 0, 10_000);
      const search =
        typeof req.query.search === 'string' && req.query.search.trim()
          ? req.query.search.trim()
          : null;

      const filter = search
        ? { clientName: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
        : {};

      const [docs, total] = await Promise.all([
        Project.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
        Project.countDocuments(filter),
      ]);

      const ids = docs.map((d) => d._id);
      const counts = await Calculation.aggregate([
        { $match: { projectId: { $in: ids } } },
        { $group: { _id: '$projectId', count: { $sum: 1 } } },
      ]);
      const countByProject = new Map(counts.map((c) => [String(c._id), c.count]));

      const projects = docs.map((doc) =>
        serializeProjectListItem({
          ...doc,
          calculationsCount: countByProject.get(String(doc._id)) ?? 0,
        }),
      );

      res.status(200).json({ ok: true, projects, total, limit, skip });
    } catch (err) {
      next(err);
    }
  });

  /**
   * @param {import('express').Request<{}, import('../types/shared-types').ProjectCreateResponse, import('../types/shared-types').ProjectCreateBody>} req
   * @param {import('express').Response<import('../types/shared-types').ProjectCreateResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.post('/api/v1/projects', async (req, res, next) => {
    try {
      const payload = validateProjectCreateBody(req.body);
      const doc = await Project.create({
        clientName: payload.clientName,
        label: payload.label,
        survey: payload.survey,
      });
      logger.info('project.create', { requestId: req.requestId ?? null }, { projectId: String(doc._id) });
      res.status(201).json({
        ok: true,
        project: serializeProjectDetail(doc.toObject(), { calculationsCount: 0 }),
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * @param {import('express').Request<{ id: string }>} req
   * @param {import('express').Response<import('../types/shared-types').ProjectGetResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.get('/api/v1/projects/:id', async (req, res, next) => {
    try {
      const oid = parseObjectIdParam(req.params.id);
      if (!oid) {
        res.status(400).json({
          ok: false,
          error: { message: 'Некорректный id проекта', code: 'VALIDATION_ERROR', statusCode: 400 },
        });
        return;
      }

      const doc = await Project.findById(oid).lean();
      if (!doc) {
        res.status(404).json({
          ok: false,
          error: { message: 'Проект не найден', code: 'PROJECT_NOT_FOUND', statusCode: 404 },
        });
        return;
      }

      const calculationsCount = await Calculation.countDocuments({ projectId: oid });

      let lastCalculation = undefined;
      if (req.query.includeLastCalculation === '1' || req.query.includeLastCalculation === 'true') {
        const last = await Calculation.findOne({ projectId: oid })
          .sort({ createdAt: -1 })
          .lean();
        if (last) lastCalculation = serializeCalculationListItem(last);
      }

      res.status(200).json({
        ok: true,
        project: serializeProjectDetail(doc, { calculationsCount, lastCalculation }),
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * @param {import('express').Request<{ id: string }, import('../types/shared-types').ProjectUpdateResponse, import('../types/shared-types').ProjectUpdateBody>} req
   * @param {import('express').Response<import('../types/shared-types').ProjectUpdateResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.put('/api/v1/projects/:id', async (req, res, next) => {
    try {
      const oid = parseObjectIdParam(req.params.id);
      if (!oid) {
        res.status(400).json({
          ok: false,
          error: { message: 'Некорректный id проекта', code: 'VALIDATION_ERROR', statusCode: 400 },
        });
        return;
      }

      const patch = validateProjectUpdateBody(req.body);
      const update = /** @type {Record<string, unknown>} */ ({});
      if (patch.clientName !== undefined) update.clientName = patch.clientName;
      if (patch.label !== undefined) update.label = patch.label;
      if (patch.survey !== undefined) update.survey = patch.survey;

      const doc = await Project.findByIdAndUpdate(oid, { $set: update }, { new: true }).lean();
      if (!doc) {
        res.status(404).json({
          ok: false,
          error: { message: 'Проект не найден', code: 'PROJECT_NOT_FOUND', statusCode: 404 },
        });
        return;
      }

      const calculationsCount = await Calculation.countDocuments({ projectId: oid });
      logger.info('project.update', { requestId: req.requestId ?? null }, { projectId: String(oid) });

      res.status(200).json({
        ok: true,
        project: serializeProjectDetail(doc, { calculationsCount }),
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * @param {import('express').Request<{ id: string }>} req
   * @param {import('express').Response<import('../types/shared-types').ProjectDeleteResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.delete('/api/v1/projects/:id', async (req, res, next) => {
    try {
      const oid = parseObjectIdParam(req.params.id);
      if (!oid) {
        res.status(400).json({
          ok: false,
          error: { message: 'Некорректный id проекта', code: 'VALIDATION_ERROR', statusCode: 400 },
        });
        return;
      }

      const deleted = await Project.findByIdAndDelete(oid);
      if (!deleted) {
        res.status(404).json({
          ok: false,
          error: { message: 'Проект не найден', code: 'PROJECT_NOT_FOUND', statusCode: 404 },
        });
        return;
      }

      const calcResult = await Calculation.deleteMany({ projectId: oid });
      logger.info('project.delete', { requestId: req.requestId ?? null }, {
        projectId: String(oid),
        calculationsRemoved: calcResult.deletedCount ?? 0,
      });

      res.status(200).json({
        ok: true,
        deleted: true,
        calculationsRemoved: calcResult.deletedCount ?? 0,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * Расчёт + сохранение в calculations; опционально обновление survey проекта.
   *
   * @param {import('express').Request<{ id: string }, import('../types/shared-types').ProjectCalcResponse, import('../types/shared-types').ProjectCalcBody>} req
   * @param {import('express').Response<import('../types/shared-types').ProjectCalcResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.post('/api/v1/projects/:id/calc', async (req, res, next) => {
    const requestId = req.requestId ?? null;
    try {
      const oid = parseObjectIdParam(req.params.id);
      if (!oid) {
        res.status(400).json({
          ok: false,
          error: { message: 'Некорректный id проекта', code: 'VALIDATION_ERROR', statusCode: 400 },
        });
        return;
      }

      const project = await Project.findById(oid);
      if (!project) {
        res.status(404).json({
          ok: false,
          error: { message: 'Проект не найден', code: 'PROJECT_NOT_FOUND', statusCode: 404 },
        });
        return;
      }

      const body = req.body ?? {};
      const saveSurvey =
        body.survey !== undefined &&
        body.survey !== null &&
        typeof body.survey === 'object' &&
        !Array.isArray(body.survey);

      if (saveSurvey) {
        const { survey } = validateProjectUpdateBody({ survey: body.survey });
        if (survey) project.survey = survey;
      }

      const calcPayload =
        body.calcInput !== undefined && body.calcInput !== null ? body.calcInput : body;

      logger.debug('project.calc.start', { requestId }, { projectId: String(oid) });

      const bundle = await getReferenceBundle();
      const input = validateAndNormalizeInput(calcPayload);
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

      const summary = extractCalculationSummary(report);
      const calcDoc = await Calculation.create({
        projectId: oid,
        calcInput: input,
        report,
        summary,
      });

      project.lastCalcInput = input;
      await project.save();

      logger.info('project.calc.done', { requestId }, {
        projectId: String(oid),
        calculationId: String(calcDoc._id),
        warnings: report?.warnings?.length ?? 0,
      });

      res.status(200).json({
        ok: true,
        report,
        calculation: serializeCalculationListItem(calcDoc.toObject()),
        project: serializeProjectDetail(project.toObject(), {
          calculationsCount: await Calculation.countDocuments({ projectId: oid }),
        }),
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * @param {import('express').Request<{ id: string }>} req
   * @param {import('express').Response<import('../types/shared-types').CalculationsListResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.get('/api/v1/projects/:id/calculations', async (req, res, next) => {
    try {
      const oid = parseObjectIdParam(req.params.id);
      if (!oid) {
        res.status(400).json({
          ok: false,
          error: { message: 'Некорректный id проекта', code: 'VALIDATION_ERROR', statusCode: 400 },
        });
        return;
      }

      const exists = await Project.exists({ _id: oid });
      if (!exists) {
        res.status(404).json({
          ok: false,
          error: { message: 'Проект не найден', code: 'PROJECT_NOT_FOUND', statusCode: 404 },
        });
        return;
      }

      const limit = parseLimit(req.query.limit, 20, 100);
      const skip = parseLimit(req.query.skip, 0, 10_000);

      const [items, total] = await Promise.all([
        Calculation.find({ projectId: oid })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Calculation.countDocuments({ projectId: oid }),
      ]);

      res.status(200).json({
        ok: true,
        calculations: items.map(serializeCalculationListItem),
        total,
        limit,
        skip,
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * @param {import('express').Request<{ projectId: string, calcId: string }>} req
   * @param {import('express').Response<import('../types/shared-types').CalculationGetResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.get('/api/v1/projects/:projectId/calculations/:calcId', async (req, res, next) => {
    try {
      const projectOid = parseObjectIdParam(req.params.projectId);
      const calcOid = parseObjectIdParam(req.params.calcId);
      if (!projectOid || !calcOid) {
        res.status(400).json({
          ok: false,
          error: { message: 'Некорректный id', code: 'VALIDATION_ERROR', statusCode: 400 },
        });
        return;
      }

      const doc = await Calculation.findOne({ _id: calcOid, projectId: projectOid }).lean();
      if (!doc) {
        res.status(404).json({
          ok: false,
          error: { message: 'Расчёт не найден', code: 'CALCULATION_NOT_FOUND', statusCode: 404 },
        });
        return;
      }

      res.status(200).json({
        ok: true,
        calculation: serializeCalculationDetail(doc),
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
