/**
 * Назначение: валидация тела POST /api/v1/projects/import.
 * Описание: ProjectExportBundle v1 и legacy SurveyDraft → нормализованный import payload.
 */

import { isPlainObject } from '../utils/isPlainObject.js';
import { throwAppError } from '../utils/createAppError.js';
import { ERROR_CODES } from '../api/errorCodes.js';
import {
  normalizeClientNameFromImport,
  normalizeLabelFromImport,
} from './validateProjectBody.js';
import { assertSurveyShape } from './validateProjectSurveyShape.js';
import { assertCalcInputJsonSize } from './documentSizeLimits.js';
import { PROJECT_EXPORT_SCHEMA_VERSION } from './projectExportConstants.js';
import {
  isLegacySurveyDraftImport,
  normalizeLegacySurveyImport,
} from './normalizeLegacySurveyImport.js';
import {
  stripCalculationImportFields,
  stripMongoExportFields,
  stripSurveyProjectId,
} from './stripMongoExportFields.js';

/**
 * @param {unknown} raw
 * @param {string} message
 * @returns {asserts raw is Record<string, unknown>}
 */
function assertPlainObject(raw, message) {
  if (!isPlainObject(raw)) {
    throwAppError(message, ERROR_CODES.VALIDATION_ERROR, 400);
  }
}

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {asserts value is Record<string, unknown>}
 */
function assertCalcObject(value, label) {
  if (!isPlainObject(value)) {
    throwAppError(`Поле ${label} має бути обʼєктом.`, ERROR_CODES.VALIDATION_ERROR, 400);
  }
}

/**
 * @param {unknown} calculationsRaw
 * @returns {Array<{
 *   calcInput: unknown,
 *   report: unknown,
 *   summary?: unknown,
 *   sourceCreatedAt?: string,
 * }>}
 */
function normalizeCalculationsImport(calculationsRaw) {
  if (calculationsRaw === undefined) return [];
  if (!Array.isArray(calculationsRaw)) {
    throwAppError('Поле calculations має бути масивом.', ERROR_CODES.VALIDATION_ERROR, 400);
  }

  /** @type {Array<{ calcInput: unknown, report: unknown, summary?: unknown, sourceCreatedAt?: string }>} */
  const out = [];

  for (let i = 0; i < calculationsRaw.length; i += 1) {
    const itemRaw = stripCalculationImportFields(
      stripMongoExportFields(calculationsRaw[i]),
    );
    if (!isPlainObject(itemRaw)) {
      throwAppError(`calculations[${i}] має бути обʼєктом.`, ERROR_CODES.VALIDATION_ERROR, 400);
    }

    assertCalcObject(itemRaw.calcInput, `calculations[${i}].calcInput`);
    assertCalcObject(itemRaw.report, `calculations[${i}].report`);
    assertCalcInputJsonSize(itemRaw.calcInput);

    /** @type {{ calcInput: unknown, report: unknown, summary?: unknown, sourceCreatedAt?: string }} */
    const item = {
      calcInput: itemRaw.calcInput,
      report: itemRaw.report,
    };
    if (itemRaw.summary !== undefined && isPlainObject(itemRaw.summary)) {
      item.summary = itemRaw.summary;
    }
    if (typeof itemRaw.sourceCreatedAt === 'string' && itemRaw.sourceCreatedAt.trim()) {
      item.sourceCreatedAt = itemRaw.sourceCreatedAt.trim();
    }
    out.push(item);
  }

  return out;
}

/**
 * @param {Record<string, unknown>} body
 * @returns {{
 *   clientName: string,
 *   label?: string,
 *   survey?: Record<string, unknown>,
 *   lastCalcInput?: unknown,
 *   calculations: Array<{
 *     calcInput: unknown,
 *     report: unknown,
 *     summary?: unknown,
 *     sourceCreatedAt?: string,
 *   }>,
 *   sourceProjectId?: string,
 * }}
 */
function normalizeProjectExportBundle(body) {
  const version = body.exportSchemaVersion;
  if (version !== PROJECT_EXPORT_SCHEMA_VERSION) {
    throwAppError(
      `Непідтримувана exportSchemaVersion: ${String(version)}.`,
      'UNSUPPORTED_EXPORT_VERSION',
      400,
    );
  }

  const projectRaw = body.project;
  assertPlainObject(projectRaw, 'Поле project має бути обʼєктом.');

  const clientName = normalizeClientNameFromImport(projectRaw.clientName);
  const label = normalizeLabelFromImport(projectRaw.label);

  let survey = stripSurveyProjectId(projectRaw.survey);
  if (survey) {
    assertSurveyShape(survey);
    survey = /** @type {Record<string, unknown>} */ (stripMongoExportFields(survey));
  }

  let lastCalcInput = projectRaw.lastCalcInput;
  if (lastCalcInput !== undefined && lastCalcInput !== null) {
    assertCalcInputJsonSize(lastCalcInput);
  } else {
    lastCalcInput = undefined;
  }

  const calculations = normalizeCalculationsImport(body.calculations);

  /** @type {{
   *   clientName: string,
   *   label?: string,
   *   survey?: Record<string, unknown>,
   *   lastCalcInput?: unknown,
   *   calculations: Array<{
   *     calcInput: unknown,
   *     report: unknown,
   *     summary?: unknown,
   *     sourceCreatedAt?: string,
   *   }>,
   *   sourceProjectId?: string,
   * }} */
  const out = { clientName, calculations };
  if (label !== undefined) out.label = label;
  if (survey !== undefined) out.survey = survey;
  if (lastCalcInput !== undefined) out.lastCalcInput = lastCalcInput;
  return out;
}

/**
 * @param {unknown} body
 * @returns {{
 *   clientName: string,
 *   label?: string,
 *   survey?: Record<string, unknown>,
 *   lastCalcInput?: unknown,
 *   calculations: Array<{
 *     calcInput: unknown,
 *     report: unknown,
 *     summary?: unknown,
 *     sourceCreatedAt?: string,
 *   }>,
 *   sourceProjectId?: string,
 * }}
 */
export function validateProjectImportBody(body) {
  assertPlainObject(body, 'Тіло запиту має бути JSON-обʼєктом.');

  let sourceProjectId;
  if (isPlainObject(body.source) && typeof body.source.projectId === 'string') {
    const trimmed = body.source.projectId.trim();
    if (trimmed) sourceProjectId = trimmed;
  }

  const cleaned = /** @type {Record<string, unknown>} */ (stripMongoExportFields(body));

  if (Object.prototype.hasOwnProperty.call(cleaned, 'exportSchemaVersion')) {
    const normalized = normalizeProjectExportBundle(cleaned);
    if (sourceProjectId !== undefined) {
      normalized.sourceProjectId = sourceProjectId;
    }
    return normalized;
  }

  if (isLegacySurveyDraftImport(cleaned)) {
    const legacy = normalizeLegacySurveyImport(cleaned);
    const clientName = normalizeClientNameFromImport(legacy.clientName);
    assertSurveyShape(legacy.survey);
    const calculations = normalizeCalculationsImport(legacy.calculations);
    return {
      clientName,
      survey: legacy.survey,
      calculations,
      ...(legacy.sourceProjectId ? { sourceProjectId: legacy.sourceProjectId } : {}),
    };
  }

  throwAppError(
    'Очікується ProjectExportBundle (exportSchemaVersion) або legacy SurveyDraft.',
    ERROR_CODES.VALIDATION_ERROR,
    400,
  );
}
