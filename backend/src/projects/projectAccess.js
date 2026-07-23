/**
 * Назначение: фильтры доступа к проектам по ownerId (защита от IDOR).
 * Описание: Production — строго ownerId (ObjectId ref User); dev без auth — legacy-документы без ownerId.
 */

import {
  isProjectsAuthRequired,
  resolveProjectsDevOwnerObjectId,
} from '../auth/projectsAuthConfig.js';
import { Project, Calculation } from '../models/public.js';
import {
  resolveMaxCalculationsPerProject,
  resolveMaxProjectsPerOwner,
} from '../auth/projectsAuthConfig.js';

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
 * @param {import('mongoose').Types.ObjectId} projectId
 * @param {import('mongoose').Types.ObjectId} ownerId
 * @returns {Promise<import('../types/shared-types.js').ProjectMongoDoc | null>}
 */
export async function findOwnedProjectLean(projectId, ownerId) {
  return Project.findOne({ _id: projectId, ...buildProjectOwnerFilter(ownerId) }).lean();
}

/**
 * @param {import('mongoose').Types.ObjectId} projectId
 * @param {import('mongoose').Types.ObjectId} ownerId
 * @returns {Promise<import('mongoose').HydratedDocument<import('../types/shared-types.js').ProjectMongoDoc> | null>}
 */
export async function findOwnedProjectDoc(projectId, ownerId) {
  return Project.findOne({ _id: projectId, ...buildProjectOwnerFilter(ownerId) });
}

/**
 * @param {import('mongoose').Types.ObjectId} ownerId
 * @returns {Promise<void>}
 */
export async function assertCanCreateProject(ownerId) {
  const max = resolveMaxProjectsPerOwner();
  const count = await Project.countDocuments(buildProjectOwnerFilter(ownerId));
  if (count >= max) {
    const err = new Error(`Превышен лимит проектов (${max})`);
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
    const err = new Error(`Превышен лимит расчётов на проект (${max})`);
    /** @type {import('../types/shared-types.js').AppErrorLike} */
    const appErr = err;
    appErr.code = 'CALCULATION_QUOTA_EXCEEDED';
    appErr.statusCode = 409;
    throw err;
  }
}
