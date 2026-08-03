/**
 * Назначение: запись импортированного ProjectExportBundle в MongoDB.
 * Описание: создаёт project + calculations без runCalculation; ownerId — текущий пользователь.
 */

import { Project, Calculation } from '../models/public.js';
import {
  assertCanCreateCalculation,
  assertCanCreateProject,
} from './projectAccess.js';
import { assertCalculationDocumentSize } from './documentSizeLimits.js';
import {
  extractCalculationSummary,
  sanitizeCalculationSummary,
} from './extractCalculationSummary.js';
import { logger } from '../utils/logger.js';
import { sortCalculationsForImport } from './sortCalculationsForImport.js';

/**
 * @param {{
 *   ownerId: import('mongoose').Types.ObjectId,
 *   payload: {
 *     clientName: string,
 *     label?: string,
 *     survey?: Record<string, unknown>,
 *     lastCalcInput?: unknown,
 *     calculations: Array<{
 *       calcInput: unknown,
 *       report: unknown,
 *       summary?: unknown,
 *       sourceCreatedAt?: string,
 *     }>,
 *     sourceProjectId?: string,
 *   },
 *   requestId?: string | null,
 * }} args
 * @returns {Promise<{
 *   project: import('mongoose').HydratedDocument<import('../types/shared-types.js').ProjectMongoDoc>,
 *   calculationsImported: number,
 * }>}
 */
export async function importProjectBundle({ ownerId, payload, requestId = null }) {
  await assertCanCreateProject(ownerId);

  /** @type {import('../types/shared-types.js').ProjectMongoDoc} */
  const createDoc = {
    ownerId,
    clientName: payload.clientName,
  };
  if (payload.label !== undefined) createDoc.label = payload.label;
  if (payload.survey !== undefined) createDoc.survey = payload.survey;
  if (payload.lastCalcInput !== undefined) createDoc.lastCalcInput = payload.lastCalcInput;

  const project = await Project.create(createDoc);
  const projectId = project._id;
  if (!projectId) {
    throw new Error('Не вдалося створити проєкт при імпорті');
  }

  const sorted = sortCalculationsForImport(payload.calculations);
  let calculationsImported = 0;

  for (const item of sorted) {
    await assertCanCreateCalculation(projectId);

    const report = /** @type {import('../types/shared-types.js').CalcReport} */ (
      /** @type {unknown} */ (item.report)
    );
    const summary =
      item.summary !== undefined
        ? sanitizeCalculationSummary(item.summary)
        : extractCalculationSummary(report);

    const calculationDocPayload = {
      projectId,
      calcInput: item.calcInput,
      report,
      summary,
    };
    assertCalculationDocumentSize(calculationDocPayload);
    await Calculation.create(calculationDocPayload);
    calculationsImported += 1;
  }

  if (payload.lastCalcInput === undefined && sorted.length > 0) {
    const lastItem = sorted[sorted.length - 1];
    if (lastItem) {
      project.lastCalcInput = /** @type {import('../types/shared-types.js').CalcRequestBody} */ (
        /** @type {unknown} */ (lastItem.calcInput)
      );
      await project.save();
    }
  }

  logger.info('project.import', requestId ? { requestId } : null, {
    projectId: String(projectId),
    ownerId: String(ownerId),
    calculationsImported,
    ...(payload.sourceProjectId ? { sourceProjectId: payload.sourceProjectId } : {}),
  });

  return { project, calculationsImported };
}
