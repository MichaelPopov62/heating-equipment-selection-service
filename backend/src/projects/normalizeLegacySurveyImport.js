/**
 * Назначение: нормализация legacy SurveyDraft для POST /projects/import.
 * Описание: файлы heatcalc-*.json без exportSchemaVersion преобразуются в import payload.
 */

import { isPlainObject } from '../utils/isPlainObject.js';
import { sanitizeTrimAngleBrackets } from '../utils/sanitizeString.js';
import { stripSurveyProjectId } from './stripMongoExportFields.js';

/**
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isLegacySurveyDraftImport(raw) {
  if (!isPlainObject(raw)) return false;
  if (Object.prototype.hasOwnProperty.call(raw, 'exportSchemaVersion')) return false;
  const clientName = sanitizeTrimAngleBrackets(raw.clientName);
  if (!clientName) return false;
  return (
    typeof raw.schemaVersion === 'number'
    || Array.isArray(raw.rooms)
    || isPlainObject(raw.objectMeta)
  );
}

/**
 * @param {Record<string, unknown>} raw
 * @returns {{
 *   clientName: string,
 *   survey: Record<string, unknown>,
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
export function normalizeLegacySurveyImport(raw) {
  const clientName = sanitizeTrimAngleBrackets(raw.clientName);
  const survey = stripSurveyProjectId(raw);
  if (!survey) {
    throw new Error('Legacy SurveyDraft без survey');
  }

  /** @type {Array<{ calcInput: unknown, report: unknown, summary?: unknown, sourceCreatedAt?: string }>} */
  const calculations = [];

  const lastCalcReport = raw.lastCalcReport;
  if (isPlainObject(lastCalcReport)) {
    const reportInput = isPlainObject(lastCalcReport.input) ? lastCalcReport.input : null;
    calculations.push({
      calcInput: reportInput ?? { building: { temps: { insideC: 20 } } },
      report: lastCalcReport,
    });
  }

  const sourceProjectId =
    typeof raw.projectId === 'string' && raw.projectId.trim()
      ? raw.projectId.trim()
      : undefined;

  return {
    clientName,
    survey,
    calculations,
    ...(sourceProjectId ? { sourceProjectId } : {}),
  };
}
