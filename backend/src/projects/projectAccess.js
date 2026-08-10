/**
 * Назначение: фильтры доступа к проектам по ownerId (IDOR) и admin bypass.
 * Описание: user — строго ownerId; admin (role=admin) — любой проект + audit cross-owner.
 */

import { canAccessAdmin } from '../auth/authorizationPolicy.js';
import {
  isProjectsAuthRequired,
  resolveProjectsDevOwnerObjectId,
} from '../auth/projectsAuthConfig.js';
import { logger } from '../utils/logger.js';
import { Project, Calculation } from '../models/public.js';
import { parseObjectIdParam } from './parseObjectId.js';
import { ERROR_CODES } from '../api/errorCodes.js';
import { resolveOwnerObjectIdByEmail } from './projectOwnerMeta.js';
import {
  resolveMaxCalculationsPerProject,
  resolveMaxProjectsPerOwner,
} from '../auth/projectsAuthConfig.js';

/**
 * @param {import('express').Request} req
 * @returns {boolean}
 */
export function isProjectsAdminRequest(req) {
  return req.user != null && canAccessAdmin(req.user);
}

/**
 * @param {import('mongoose').Types.ObjectId} ownerId
 * @returns {import('mongoose').QueryFilter<import('../types/shared-types.js').ProjectMongoDoc>}
 */
export function buildProjectOwnerFilter(ownerId) {
  if (!isProjectsAuthRequired()) {
    const devOwnerId = resolveProjectsDevOwnerObjectId();
    if (ownerId.equals(devOwnerId)) {
      return {
        $or: [
          { ownerId },
          { ownerId: { $exists: false } },
          { ownerId: null },
        ],
      };
    }
  }
  return { ownerId };
}

/**
 * Запрет admin-only query-параметров для role=user.
 *
 * @param {import('express').Request} req
 * @returns {string | null} сообщение ошибки или null
 */
export function validateProjectsListQueryForRole(req) {
  if (isProjectsAdminRequest(req)) return null;
  const ownerIdQ =
    typeof req.query.ownerId === 'string' && req.query.ownerId.trim()
      ? req.query.ownerId.trim()
      : '';
  const ownerEmailQ =
    typeof req.query.ownerEmail === 'string' && req.query.ownerEmail.trim()
      ? req.query.ownerEmail.trim()
      : '';
  if (ownerIdQ || ownerEmailQ) {
    return 'Фільтр ownerId/ownerEmail доступний лише адміністратору (role=admin)';
  }
  return null;
}

/**
 * Фильтр списка проектов: user — свои; admin — все или по ownerId/ownerEmail.
 *
 * @param {import('express').Request} req
 * @param {import('mongoose').Types.ObjectId} requesterOwnerId
 * @returns {Promise<import('mongoose').QueryFilter<import('../types/shared-types.js').ProjectMongoDoc>>}
 */
export async function resolveProjectListFilter(req, requesterOwnerId) {
  if (!isProjectsAdminRequest(req)) {
    return buildProjectOwnerFilter(requesterOwnerId);
  }

  /** @type {import('mongoose').QueryFilter<import('../types/shared-types.js').ProjectMongoDoc>} */
  const filter = {};

  const ownerIdRaw =
    typeof req.query.ownerId === 'string' && req.query.ownerId.trim()
      ? req.query.ownerId.trim()
      : '';
  const ownerEmailRaw =
    typeof req.query.ownerEmail === 'string' && req.query.ownerEmail.trim()
      ? req.query.ownerEmail.trim()
      : '';

  if (ownerIdRaw) {
    const oid = parseObjectIdParam(ownerIdRaw);
    if (!oid) {
      const err = new Error('Некоректний query ownerId');
      /** @type {import('../types/shared-types.js').AppErrorLike} */
      const appErr = err;
      appErr.code = ERROR_CODES.VALIDATION_ERROR;
      appErr.statusCode = 400;
      throw err;
    }
    filter.ownerId = oid;
  } else if (ownerEmailRaw) {
    const ownerOid = await resolveOwnerObjectIdByEmail(ownerEmailRaw);
    if (!ownerOid) {
      return { _id: { $in: [] } };
    }
    filter.ownerId = ownerOid;
  }

  return filter;
}

/**
 * @param {import('mongoose').Types.ObjectId} projectId
 * @param {import('mongoose').Types.ObjectId} requesterOwnerId
 * @param {import('express').Request} req
 * @returns {import('mongoose').QueryFilter<import('../types/shared-types.js').ProjectMongoDoc>}
 */
export function buildAccessibleProjectByIdFilter(projectId, requesterOwnerId, req) {
  if (isProjectsAdminRequest(req)) {
    return { _id: projectId };
  }
  return { _id: projectId, ...buildProjectOwnerFilter(requesterOwnerId) };
}

/**
 * Audit: admin открывает/изменяет проект другого владельца.
 *
 * @param {import('express').Request} req
 * @param {import('../types/shared-types.js').ProjectMongoDoc | Record<string, unknown>} projectDoc
 * @param {string} action
 */
export function logAdminCrossOwnerProjectAccess(req, projectDoc, action) {
  if (!isProjectsAdminRequest(req) || !req.user?.id) return;

  const projectOwnerRaw = projectDoc.ownerId;
  const projectOwnerId =
    projectOwnerRaw != null ? String(projectOwnerRaw) : '';
  const adminUserId = req.user.id;

  if (!projectOwnerId || projectOwnerId === adminUserId) return;

  const projectIdRaw = projectDoc._id;
  logger.info('projects.admin.cross_owner', req.requestId ? { requestId: req.requestId } : null, {
    action,
    projectId: projectIdRaw != null ? String(projectIdRaw) : '',
    projectOwnerId,
    adminUserId,
  });
}

/**
 * @param {import('mongoose').Types.ObjectId} projectId
 * @param {import('mongoose').Types.ObjectId} requesterOwnerId
 * @param {import('express').Request} req
 * @returns {Promise<import('../types/shared-types.js').ProjectMongoDoc | null>}
 */
export async function findAccessibleProjectLean(projectId, requesterOwnerId, req) {
  const doc = await Project.findOne(
    buildAccessibleProjectByIdFilter(projectId, requesterOwnerId, req),
  ).lean();
  if (doc) {
    logAdminCrossOwnerProjectAccess(req, doc, 'read');
  }
  return doc;
}

/**
 * @param {import('mongoose').Types.ObjectId} projectId
 * @param {import('mongoose').Types.ObjectId} requesterOwnerId
 * @param {import('express').Request} req
 * @returns {Promise<import('mongoose').HydratedDocument<import('../types/shared-types.js').ProjectMongoDoc> | null>}
 */
export async function findAccessibleProjectDoc(projectId, requesterOwnerId, req) {
  const doc = await Project.findOne(
    buildAccessibleProjectByIdFilter(projectId, requesterOwnerId, req),
  );
  if (doc) {
    logAdminCrossOwnerProjectAccess(req, doc.toObject(), 'read');
  }
  return doc;
}


/**
 * @param {import('mongoose').Types.ObjectId} ownerId
 * @returns {Promise<void>}
 */
export async function assertCanCreateProject(ownerId) {
  const max = resolveMaxProjectsPerOwner();
  const count = await Project.countDocuments(buildProjectOwnerFilter(ownerId));
  if (count >= max) {
    const err = new Error(`Перевищено ліміт проєктів (${max})`);
    /** @type {import('../types/shared-types.js').AppErrorLike} */
    const appErr = err;
    appErr.code = 'PROJECT_QUOTA_EXCEEDED';
    appErr.statusCode = 409;
    throw err;
  }
}

/**
 * @param {import('mongoose').Types.ObjectId} projectId
 * @returns {Promise<void>}
 */
export async function assertCanCreateCalculation(projectId) {
  const max = resolveMaxCalculationsPerProject();
  const count = await Calculation.countDocuments({ projectId });
  if (count >= max) {
    const err = new Error(`Перевищено ліміт розрахунків на проєкт (${max})`);
    /** @type {import('../types/shared-types.js').AppErrorLike} */
    const appErr = err;
    appErr.code = 'CALCULATION_QUOTA_EXCEEDED';
    appErr.statusCode = 409;
    throw err;
  }
}
