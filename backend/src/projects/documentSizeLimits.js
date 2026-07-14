/**
 * Назначение: лимиты размера документов проектов и расчётов в MongoDB.
 * Описание: JSON-лимит calcInput/survey и оценка BSON до записи в calculations (лимит 16 MB).
 */

import { calculateObjectSize } from 'bson';

/** Лимит survey/calcInput в JSON (символы) — защита от слишком больших payload. */
export const MAX_SURVEY_JSON_CHARS = 512_000;

/** Симметричный лимит нормализованного CalcInput (до расчёта). */
export const MAX_CALC_INPUT_JSON_CHARS = 512_000;

/** Запас до лимита BSON MongoDB (16 MB) на документ calculations. */
export const MAX_CALCULATION_DOC_BSON_BYTES = 14_000_000;

/**
 * @param {string} message
 * @param {string} code
 * @returns {never}
 */
function throwPayloadTooLarge(message, code) {
  const err = new Error(message);
  /** @type {import('../types/shared-types.js').AppErrorLike} */
  const appErr = err;
  appErr.statusCode = 413;
  appErr.code = code;
  throw err;
}

/**
 * Проверяет размер CalcInput по JSON.stringify (до runCalculation).
 *
 * @param {unknown} calcInput
 */
export function assertCalcInputJsonSize(calcInput) {
  let serialized;
  try {
    serialized = JSON.stringify(calcInput);
  } catch {
    throwPayloadTooLarge('Слишком большой или невалидный вход расчёта (calcInput).', 'CALC_INPUT_TOO_LARGE');
  }
  if (serialized.length > MAX_CALC_INPUT_JSON_CHARS) {
    throwPayloadTooLarge('Слишком большой вход расчёта (calcInput).', 'CALC_INPUT_TOO_LARGE');
  }
}

/**
 * Оценивает размер BSON документа calculations (без _id/timestamps Mongoose).
 *
 * @param {{ projectId: import('mongoose').Types.ObjectId, calcInput: unknown, report: unknown, summary: unknown }} doc
 * @returns {number}
 */
export function estimateCalculationDocBsonBytes(doc) {
  return calculateObjectSize(doc);
}

/**
 * Проверяет, что документ расчёта поместится в MongoDB до Calculation.create.
 *
 * @param {{ projectId: import('mongoose').Types.ObjectId, calcInput: unknown, report: unknown, summary: unknown }} doc
 * @returns {number} оценка BSON в байтах
 */
export function assertCalculationDocumentSize(doc) {
  const bytes = estimateCalculationDocBsonBytes(doc);
  if (bytes > MAX_CALCULATION_DOC_BSON_BYTES) {
    throwPayloadTooLarge(
      `Документ расчёта слишком большой для сохранения (${bytes} байт, лимит ${MAX_CALCULATION_DOC_BSON_BYTES}).`,
      'CALCULATION_DOCUMENT_TOO_LARGE',
    );
  }
  return bytes;
}

/**
 * MongoDB / драйвер: документ превысил лимит BSON (код 10334).
 *
 * @param {unknown} err
 * @returns {boolean}
 */
export function isMongoBsonObjectTooLargeError(err) {
  if (!err || typeof err !== 'object') return false;
  const rec = /** @type {Record<string, unknown>} */ (err);
  if (rec.code === 10334) return true;
  const msg = String(rec.message ?? '');
  return msg.includes('BSONObjectTooLarge') || msg.includes('document is too large');
}
