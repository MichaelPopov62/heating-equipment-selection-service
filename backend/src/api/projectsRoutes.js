/**
 * Назначение: REST API проектов и расчётов.
 * Описание: CRUD для проектов клиента (ownerId + JWT) и расчётов в MongoDB. Rate limit и квоты. Экспортирует createProjectsRouter().
 */

import express from 'express';
import { Project, Calculation } from '../models/public.js';
import { requireAuth } from '../auth/requireAuth.js';
import { resolveProjectsDevOwnerObjectId } from '../auth/projectsAuthConfig.js';
import {
  projectCalcRateLimiter,
  projectsReadRateLimiter,
  projectsWriteRateLimiter,
} from './middleware/rateLimiters.js';
import { runCalculation } from './runCalculation.js';
import { extractCalculationSummary } from '../projects/extractCalculationSummary.js';
import {
  validateProjectCreateBody,
  validateProjectUpdateBody,
} from '../projects/validateProjectBody.js';
import { parseObjectIdParam } from '../projects/parseObjectId.js';
import { requireMongoForProjects } from '../projects/requireMongo.js';
import {
  assertCanCreateCalculation,
  assertCanCreateProject,
  buildProjectOwnerFilter,
  findOwnedProjectDoc,
  findOwnedProjectLean,
} from '../projects/projectAccess.js';
import {
  serializeCalculationDetail,
  serializeCalculationListItem,
  serializeProjectDetail,
  serializeProjectListItem,
} from '../projects/serializeProject.js';
import { resolveProjectCalcInput } from '../projects/resolveProjectCalcInput.js';
import { assertCalculationDocumentSize } from '../projects/documentSizeLimits.js';
import {
  calcInputAuditMeta,
  projectPatchFields,
  surveyAuditMeta,
} from '../projects/projectChangeMeta.js';
import { buildShareSnapshot } from '../projects/buildShareSnapshot.js';
import { generateShareToken } from '../projects/shareToken.js';
import { serializeProjectShareMeta } from '../projects/serializeShare.js';
import { parseIncludeTechnicalQuery } from '../projects/parseIncludeTechnicalQuery.js';
import { renderEstimatePdf } from '../projects/renderEstimatePdf.js';
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
 * ObjectId владельца проекта: req.user.id (users._id) или dev-fallback без JWT.
 *
 * @param {import('express').Request} req
 * @returns {import('mongoose').Types.ObjectId}
 */
function ownerIdFromRequest(req) {
  if (req.user?.id) {
    const oid = parseObjectIdParam(req.user.id);
    if (oid) return oid;
  }
  return resolveProjectsDevOwnerObjectId();
}

/**
 * Мета для logger с optional requestId (exactOptionalPropertyTypes).
 *
 * @param {import('express').Request} req
 * @returns {{ requestId: string } | null}
 */
function reqLogMeta(req) {
  return req.requestId ? { requestId: req.requestId } : null;
}

/**
 * Параметр маршрута Express → строка (checkJs: params может быть string | string[]).
 *
 * @param {unknown} value
 * @returns {string}
 */
function asRouteParam(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
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

  router.use('/api/v1/projects', mongoMiddleware, requireAuth);

  /**
   * @param {import('express').Request} req
   * @param {import('express').Response<import('../types/shared-types.js').ProjectsListResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.get('/api/v1/projects', projectsReadRateLimiter, async (req, res, next) => {
    try {
      const ownerId = ownerIdFromRequest(req);
      const limit = parseLimit(req.query.limit, 50, 100);
      const skip = parseLimit(req.query.skip, 0, 10_000);
      const search =
        typeof req.query.search === 'string' && req.query.search.trim()
          ? req.query.search.trim()
          : null;

      /** @type {import('mongoose').QueryFilter<import('../types/shared-types.js').ProjectMongoDoc>} */
      const filter = { ...buildProjectOwnerFilter(ownerId) };
      if (search) {
        filter.clientName = {
          $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
          $options: 'i',
        };
      }

      const [docsRaw, total] = await Promise.all([
        Project.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
        Project.countDocuments(filter),
      ]);
      /** @type {import('../types/shared-types.js').ProjectMongoDoc[]} */
      const docs = docsRaw;

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
   * @param {import('express').Request<{}, import('../types/shared-types.js').ProjectCreateResponse, import('../types/shared-types.js').ProjectCreateBody>} req
   * @param {import('express').Response<import('../types/shared-types.js').ProjectCreateResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.post('/api/v1/projects', projectsWriteRateLimiter, async (req, res, next) => {
    try {
      const ownerId = ownerIdFromRequest(req);
      await assertCanCreateProject(ownerId);

      const payload = validateProjectCreateBody(req.body);
      /** @type {import('../types/shared-types.js').ProjectMongoDoc} */
      const createDoc = {
        ownerId: ownerId,
        clientName: payload.clientName,
      };
      if (payload.label !== undefined) createDoc.label = payload.label;
      if (payload.survey !== undefined) createDoc.survey = payload.survey;

      const doc = await Project.create(createDoc);
      logger.info('project.create', reqLogMeta(req), {
        projectId: String(doc._id),
        ownerId: ownerId,
        survey: surveyAuditMeta(payload.survey),
      });
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
   * @param {import('express').Response<import('../types/shared-types.js').ProjectGetResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.get('/api/v1/projects/:id', projectsReadRateLimiter, async (req, res, next) => {
    try {
      const ownerId = ownerIdFromRequest(req);
      const oid = parseObjectIdParam(asRouteParam(req.params.id));
      if (!oid) {
        res.status(400).json({
          ok: false,
          error: { message: 'Некорректный id проекта', code: 'VALIDATION_ERROR', statusCode: 400 },
        });
        return;
      }

      const doc = await findOwnedProjectLean(oid, ownerId);
      if (!doc) {
        res.status(404).json({
          ok: false,
          error: { message: 'Проект не найден', code: 'PROJECT_NOT_FOUND', statusCode: 404 },
        });
        return;
      }

      const calculationsCount = await Calculation.countDocuments({ projectId: oid });

      /** @type {import('../types/shared-types.js').CalculationListItem | undefined} */
      let lastCalculation;
      if (req.query.includeLastCalculation === '1' || req.query.includeLastCalculation === 'true') {
        const last = await Calculation.findOne({ projectId: oid })
          .sort({ createdAt: -1 })
          .lean();
        if (last) lastCalculation = serializeCalculationListItem(last);
      }

      /** @type {{ calculationsCount: number; lastCalculation?: import('../types/shared-types.js').CalculationListItem }} */
      const detailExtra = { calculationsCount };
      if (lastCalculation !== undefined) {
        detailExtra.lastCalculation = lastCalculation;
      }

      res.status(200).json({
        ok: true,
        project: serializeProjectDetail(doc, detailExtra),
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * @param {import('express').Request<{ id: string }, import('../types/shared-types.js').ProjectUpdateResponse, import('../types/shared-types.js').ProjectUpdateBody>} req
   * @param {import('express').Response<import('../types/shared-types.js').ProjectUpdateResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.put('/api/v1/projects/:id', projectsWriteRateLimiter, async (req, res, next) => {
    try {
      const ownerId = ownerIdFromRequest(req);
      const oid = parseObjectIdParam(asRouteParam(req.params.id));
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

      const doc = await Project.findOneAndUpdate(
        { _id: oid, ...buildProjectOwnerFilter(ownerId) },
        { $set: update },
        { new: true },
      ).lean();

      if (!doc) {
        res.status(404).json({
          ok: false,
          error: { message: 'Проект не найден', code: 'PROJECT_NOT_FOUND', statusCode: 404 },
        });
        return;
      }

      const calculationsCount = await Calculation.countDocuments({ projectId: oid });
      logger.info('project.update', reqLogMeta(req), {
        projectId: String(oid),
        ownerId: ownerId,
        changedFields: projectPatchFields(/** @type {Record<string, unknown>} */ (patch)),
        ...(patch.survey !== undefined ? { survey: surveyAuditMeta(patch.survey) } : {}),
      });

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
   * @param {import('express').Response<import('../types/shared-types.js').ProjectDeleteResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.delete('/api/v1/projects/:id', projectsWriteRateLimiter, async (req, res, next) => {
    try {
      const ownerId = ownerIdFromRequest(req);
      const oid = parseObjectIdParam(asRouteParam(req.params.id));
      if (!oid) {
        res.status(400).json({
          ok: false,
          error: { message: 'Некорректный id проекта', code: 'VALIDATION_ERROR', statusCode: 400 },
        });
        return;
      }

      const deleted = await Project.findOneAndDelete({
        _id: oid,
        ...buildProjectOwnerFilter(ownerId),
      });

      if (!deleted) {
        res.status(404).json({
          ok: false,
          error: { message: 'Проект не найден', code: 'PROJECT_NOT_FOUND', statusCode: 404 },
        });
        return;
      }

      const calcResult = await Calculation.deleteMany({ projectId: oid });
      logger.info('project.delete', reqLogMeta(req), {
        projectId: String(oid),
        ownerId: ownerId,
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
   * @param {import('express').Request<{ id: string }, import('../types/shared-types.js').ProjectCalcResponse, import('../types/shared-types.js').ProjectCalcBody>} req
   * @param {import('express').Response<import('../types/shared-types.js').ProjectCalcResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.post('/api/v1/projects/:id/calc', projectCalcRateLimiter, async (req, res, next) => {
    const logMeta = reqLogMeta(req);
    /** @type {string | undefined} */
    let projectIdForLog;
    /** @type {string | undefined} */
    let ownerIdForLog;
    /** @type {'calcInput' | 'body' | 'lastCalcInput' | undefined} */
    let calcInputSource;
    /** @type {boolean | undefined} */
    let surveyInRequest;
    try {
      const ownerId = ownerIdFromRequest(req);
      ownerIdForLog = String(ownerId);
      const oid = parseObjectIdParam(asRouteParam(req.params.id));
      if (!oid) {
        res.status(400).json({
          ok: false,
          error: { message: 'Некорректный id проекта', code: 'VALIDATION_ERROR', statusCode: 400 },
        });
        return;
      }

      const projectRaw = await findOwnedProjectDoc(oid, ownerId);
      if (!projectRaw) {
        res.status(404).json({
          ok: false,
          error: { message: 'Проект не найден', code: 'PROJECT_NOT_FOUND', statusCode: 404 },
        });
        return;
      }

      /** @type {import('mongoose').Document & {
       *   survey?: unknown;
       *   lastCalcInput?: import('../types/shared-types.js').CalcRequestBody;
       *   ownerId?: import('mongoose').Types.ObjectId;
       * }} */
      const project = /** @type {import('mongoose').Document & {
       *   survey?: unknown;
       *   lastCalcInput?: import('../types/shared-types.js').CalcRequestBody;
       *   ownerId?: import('mongoose').Types.ObjectId;
       * }} */ (projectRaw);

      await assertCanCreateCalculation(oid);

      projectIdForLog = String(oid);

      const body = req.body ?? {};
      const saveSurvey =
        body.survey !== undefined &&
        body.survey !== null &&
        typeof body.survey === 'object' &&
        !Array.isArray(body.survey);
      surveyInRequest = saveSurvey;

      if (saveSurvey) {
        const { survey } = validateProjectUpdateBody({ survey: body.survey });
        if (survey) project.survey = survey;
      }

      const resolved = resolveProjectCalcInput(body, project.lastCalcInput);
      calcInputSource = resolved.source;

      logger.info('project.calc.start', logMeta, {
        projectId: projectIdForLog,
        ownerId: ownerId,
        calcInputSource,
        surveyInRequest: saveSurvey,
        ...(saveSurvey ? { survey: surveyAuditMeta(body.survey) } : {}),
        lastCalcInput: calcInputAuditMeta(project.lastCalcInput),
      });

      if (calcInputSource === 'lastCalcInput' && !saveSurvey) {
        logger.info('project.calc.reuseLastInput', logMeta, {
          projectId: projectIdForLog,
          ownerId: ownerId,
        });
      }

      const calcPayload = resolved.payload;

      const { input, report } = await runCalculation(calcPayload);

      const summary = extractCalculationSummary(report);
      const calculationDocPayload = {
        projectId: oid,
        calcInput: input,
        report,
        summary,
      };
      const estimatedBsonBytes = assertCalculationDocumentSize(calculationDocPayload);
      const calcDoc = await Calculation.create(calculationDocPayload);

      if (!project.ownerId) {
        project.ownerId = ownerId;
      }
      project.lastCalcInput = input;
      await project.save();

      logger.info('project.calc.done', logMeta, {
        projectId: projectIdForLog,
        ownerId: ownerId,
        calculationId: String(calcDoc._id),
        calcInputSource,
        surveySaved: saveSurvey,
        lastCalcInputUpdated: true,
        calcInput: calcInputAuditMeta(input),
        heatLossKw: summary.heatLossKw,
        objectType: summary.objectType,
        boilerRequiredKw: summary.boilerRequiredKw,
        warnings: report?.warnings?.length ?? 0,
        estimatedBsonBytes,
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
      logger.error('project.calc.fail', logMeta, {
        projectId: projectIdForLog,
        ownerId: ownerIdForLog,
        calcInputSource,
        surveyInRequest,
        internalMessage: err instanceof Error ? err.message : String(err),
      });
      next(err);
    }
  });

  /**
   * @param {import('express').Request<{ id: string }>} req
   * @param {import('express').Response<import('../types/shared-types.js').CalculationsListResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.get('/api/v1/projects/:id/calculations', projectsReadRateLimiter, async (req, res, next) => {
    try {
      const ownerId = ownerIdFromRequest(req);
      const oid = parseObjectIdParam(asRouteParam(req.params.id));
      if (!oid) {
        res.status(400).json({
          ok: false,
          error: { message: 'Некорректный id проекта', code: 'VALIDATION_ERROR', statusCode: 400 },
        });
        return;
      }

      const owned = await findOwnedProjectLean(oid, ownerId);
      if (!owned) {
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
   * @param {import('express').Response<import('../types/shared-types.js').CalculationGetResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.get(
    '/api/v1/projects/:projectId/calculations/:calcId',
    projectsReadRateLimiter,
    async (req, res, next) => {
      try {
        const ownerId = ownerIdFromRequest(req);
        const projectOid = parseObjectIdParam(asRouteParam(req.params.projectId));
        const calcOid = parseObjectIdParam(asRouteParam(req.params.calcId));
        if (!projectOid || !calcOid) {
          res.status(400).json({
            ok: false,
            error: { message: 'Некорректный id', code: 'VALIDATION_ERROR', statusCode: 400 },
          });
          return;
        }

        const owned = await findOwnedProjectLean(projectOid, ownerId);
        if (!owned) {
          res.status(404).json({
            ok: false,
            error: { message: 'Проект не найден', code: 'PROJECT_NOT_FOUND', statusCode: 404 },
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
    },
  );

  /**
   * Скачать PDF сметы (owner). Источник — последний сохранённый расчёт проекта.
   *
   * @param {import('express').Request<{ id: string }>} req
   * @param {import('express').Response} res
   * @param {import('express').NextFunction} next
   */
  router.get(
    '/api/v1/projects/:id/pdf',
    projectsReadRateLimiter,
    async (req, res, next) => {
      try {
        const ownerId = ownerIdFromRequest(req);
        const oid = parseObjectIdParam(asRouteParam(req.params.id));
        if (!oid) {
          res.status(400).json({
            ok: false,
            error: { message: 'Некорректный id проекта', code: 'VALIDATION_ERROR', statusCode: 400 },
          });
          return;
        }

        const project = await findOwnedProjectLean(oid, ownerId);
        if (!project) {
          res.status(404).json({
            ok: false,
            error: { message: 'Проект не найден', code: 'PROJECT_NOT_FOUND', statusCode: 404 },
          });
          return;
        }

        const calcDoc = await Calculation.findOne({ projectId: oid }).sort({ createdAt: -1 }).lean();
        if (!calcDoc || !/** @type {{ report?: unknown }} */ (calcDoc).report) {
          res.status(400).json({
            ok: false,
            error: {
              message: 'Нет сохранённого расчёта для PDF',
              code: 'PDF_REPORT_REQUIRED',
              statusCode: 400,
            },
          });
          return;
        }

        const includeTechnical = parseIncludeTechnicalQuery(req.query.includeTechnical);
        const snapshot = buildShareSnapshot({
          clientName: String(project.clientName ?? ''),
          label: project.label != null ? String(project.label) : null,
          report: /** @type {{ report: unknown }} */ (calcDoc).report,
        });

        const started = Date.now();
        const pdf = await renderEstimatePdf(snapshot, { includeTechnical });
        logger.info('project.pdf.download', reqLogMeta(req), {
          projectId: String(oid),
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

  /**
   * Публикация / обновление публичной ссылки (owner). Тело: { calculationId? } или берётся последний calc.
   *
   * @param {import('express').Request<{ id: string }>} req
   * @param {import('express').Response<import('../types/shared-types.js').ProjectSharePublishResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.post(
    '/api/v1/projects/:id/share',
    projectsWriteRateLimiter,
    async (req, res, next) => {
      try {
        const ownerId = ownerIdFromRequest(req);
        const oid = parseObjectIdParam(asRouteParam(req.params.id));
        if (!oid) {
          res.status(400).json({
            ok: false,
            error: { message: 'Некорректный id проекта', code: 'VALIDATION_ERROR', statusCode: 400 },
          });
          return;
        }

        const project = await findOwnedProjectDoc(oid, ownerId);
        if (!project) {
          res.status(404).json({
            ok: false,
            error: { message: 'Проект не найден', code: 'PROJECT_NOT_FOUND', statusCode: 404 },
          });
          return;
        }

        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const calcIdRaw =
          typeof /** @type {{ calculationId?: unknown }} */ (body).calculationId === 'string'
            ? /** @type {{ calculationId: string }} */ (body).calculationId.trim()
            : '';

        /** @type {import('mongoose').Document | Record<string, unknown> | null} */
        let calcDoc = null;
        if (calcIdRaw) {
          const calcOid = parseObjectIdParam(calcIdRaw);
          if (!calcOid) {
            res.status(400).json({
              ok: false,
              error: {
                message: 'Некорректный calculationId',
                code: 'VALIDATION_ERROR',
                statusCode: 400,
              },
            });
            return;
          }
          calcDoc = await Calculation.findOne({ _id: calcOid, projectId: oid }).lean();
          if (!calcDoc) {
            res.status(404).json({
              ok: false,
              error: {
                message: 'Расчёт не найден',
                code: 'CALCULATION_NOT_FOUND',
                statusCode: 404,
              },
            });
            return;
          }
        } else {
          calcDoc = await Calculation.findOne({ projectId: oid }).sort({ createdAt: -1 }).lean();
        }

        if (!calcDoc || !/** @type {{ report?: unknown }} */ (calcDoc).report) {
          res.status(400).json({
            ok: false,
            error: {
              message: 'Нет сохранённого расчёта для публикации ссылки',
              code: 'SHARE_REPORT_REQUIRED',
              statusCode: 400,
            },
          });
          return;
        }

        const projectPlain = project.toObject();

        const snapshot = buildShareSnapshot({
          clientName: String(projectPlain.clientName ?? ''),
          label: projectPlain.label != null ? String(projectPlain.label) : null,
          report: /** @type {{ report: unknown }} */ (calcDoc).report,
        });

        const existingToken =
          typeof projectPlain.shareToken === 'string' && projectPlain.shareToken.trim()
            ? projectPlain.shareToken.trim()
            : null;
        const shareToken = existingToken ?? generateShareToken();
        const sharePublishedAt = new Date();

        const updated = await Project.findOneAndUpdate(
          { _id: oid, ...buildProjectOwnerFilter(ownerId) },
          {
            $set: {
              shareToken,
              sharePublishedAt,
              shareSnapshot: snapshot,
            },
          },
          { new: true },
        ).lean();

        if (!updated) {
          res.status(404).json({
            ok: false,
            error: { message: 'Проект не найден', code: 'PROJECT_NOT_FOUND', statusCode: 404 },
          });
          return;
        }

        const calculationsCount = await Calculation.countDocuments({ projectId: oid });
        const shareMeta = serializeProjectShareMeta(updated);
        if (!shareMeta) {
          /** @type {Error & import('../types/shared-types.js').AppErrorLike} */
          const err = new Error('Не удалось сериализовать share');
          err.statusCode = 500;
          err.code = 'INTERNAL_ERROR';
          throw err;
        }

        logger.info('project.share.publish', reqLogMeta(req), {
          projectId: String(oid),
          ownerId: ownerId,
          rotated: !existingToken,
        });

        res.status(200).json({
          ok: true,
          shareToken: shareMeta.shareToken,
          sharePublishedAt: shareMeta.sharePublishedAt,
          publicPath: shareMeta.publicPath,
          project: serializeProjectDetail(updated, { calculationsCount }),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * Отзыв публичной ссылки (owner).
   *
   * @param {import('express').Request<{ id: string }>} req
   * @param {import('express').Response<import('../types/shared-types.js').ProjectShareRevokeResponse>} res
   * @param {import('express').NextFunction} next
   */
  router.delete(
    '/api/v1/projects/:id/share',
    projectsWriteRateLimiter,
    async (req, res, next) => {
      try {
        const ownerId = ownerIdFromRequest(req);
        const oid = parseObjectIdParam(asRouteParam(req.params.id));
        if (!oid) {
          res.status(400).json({
            ok: false,
            error: { message: 'Некорректный id проекта', code: 'VALIDATION_ERROR', statusCode: 400 },
          });
          return;
        }

        const project = await findOwnedProjectDoc(oid, ownerId);
        if (!project) {
          res.status(404).json({
            ok: false,
            error: { message: 'Проект не найден', code: 'PROJECT_NOT_FOUND', statusCode: 404 },
          });
          return;
        }

        await Project.updateOne(
          { _id: oid, ...buildProjectOwnerFilter(ownerId) },
          { $unset: { shareToken: 1, sharePublishedAt: 1, shareSnapshot: 1 } },
        );

        const refreshed = await findOwnedProjectLean(oid, ownerId);
        const calculationsCount = await Calculation.countDocuments({ projectId: oid });

        logger.info('project.share.revoke', reqLogMeta(req), {
          projectId: String(oid),
          ownerId: ownerId,
        });

        res.status(200).json({
          ok: true,
          revoked: true,
          project: serializeProjectDetail(refreshed ?? { _id: oid, clientName: '' }, {
            calculationsCount,
          }),
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
