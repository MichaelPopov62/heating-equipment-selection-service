/**
 * Назначение: фильтры доступа к проектам по ownerId (защита от IDOR).
 * Описание: Production — строго ownerId; dev без auth — legacy-документы без ownerId для dev-local.
 */

import { isProjectsAuthRequired, resolveProjectsDevOwnerId } from '../auth/projectsAuthConfig.js';
import { Project, Calculation } from '../models/public.js';
import {
  resolveMaxCalculationsPerProject,
  resolveMaxProjectsPerOwner,
} from '../auth/projectsAuthConfig.js';

/**
 * @param {string} ownerSub
 * @returns {Record<string, unknown>}
 */
export function buildProjectOwnerFilter(ownerSub) {
  if (!isProjectsAuthRequired()) {
    const devId = resolveProjectsDevOwnerId();
    if (ownerSub === devId) {
      return {
        $or: [
          { ownerId: ownerSub },
          { ownerId: { $exists: false } },
          { ownerId: null },
          { ownerId: '' },
        ],
      };
    }
  }
  return { ownerId: ownerSub };
}

/**
 * @param {import('mongoose').Types.ObjectId} projectId
 * @param {string} ownerSub
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function findOwnedProjectLean(projectId, ownerSub) {
  return Project.findOne({ _id: projectId, ...buildProjectOwnerFilter(ownerSub) }).lean();
}

/**
 * @param {import('mongoose').Types.ObjectId} projectId
 * @param {string} ownerSub
 * @returns {Promise<import('mongoose').Document | null>}
 */
export async function findOwnedProjectDoc(projectId, ownerSub) {
  return Project.findOne({ _id: projectId, ...buildProjectOwnerFilter(ownerSub) });
}

/**
 * @param {string} ownerSub
 * @returns {Promise<void>}
 */
export async function assertCanCreateProject(ownerSub) {
  const max = resolveMaxProjectsPerOwner();
  const count = await Project.countDocuments(buildProjectOwnerFilter(ownerSub));
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
