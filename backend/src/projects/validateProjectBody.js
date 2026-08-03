/**
 * Назначение: валидация тела запросов проектов.
 * Описание: проверка и нормализация clientName, label и survey при создании и обновлении проекта;
 * ограничение размера payload и санитизация строк.
 */
import { isPlainObject } from '../utils/isPlainObject.js';
import { sanitizeTrimAngleBrackets } from '../utils/sanitizeString.js';
import { throwAppError } from '../utils/createAppError.js';
import { assertSurveyShape } from './validateProjectSurveyShape.js';

const MAX_CLIENT_NAME_LEN = 200;
const MAX_LABEL_LEN = 200;

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeClientNameFromImport(raw) {
  const name = sanitizeTrimAngleBrackets(raw);
  if (!name) {
    throwAppError('Вкажіть імʼя клієнта (clientName).', 'VALIDATION_ERROR', 400);
  }
  if (name.length > MAX_CLIENT_NAME_LEN) {
    throwAppError(
      `Імʼя клієнта не довше ${MAX_CLIENT_NAME_LEN} символів.`,
      'VALIDATION_ERROR',
      400,
    );
  }
  return name;
}

/**
 * @param {unknown} raw
 * @returns {string | undefined}
 */
export function normalizeLabelFromImport(raw) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const label = sanitizeTrimAngleBrackets(raw);
  if (!label) return undefined;
  if (label.length > MAX_LABEL_LEN) {
    throwAppError(
      `Підпис обʼєкта не довше ${MAX_LABEL_LEN} символів.`,
      'VALIDATION_ERROR',
      400,
    );
  }
  return label;
}

/**
 * @param {unknown} body
 * @returns {{ clientName: string, label?: string, survey?: Record<string, unknown> }}
 */
export function validateProjectCreateBody(body) {
  if (!isPlainObject(body)) {
    throwAppError('Тіло запиту має бути JSON-обʼєктом.', 'VALIDATION_ERROR', 400);
  }
  const clientName = normalizeClientNameFromImport(body.clientName);
  const label = normalizeLabelFromImport(body.label);
  assertSurveyShape(body.survey);

  /** @type {{ clientName: string, label?: string, survey?: Record<string, unknown> }} */
  const out = { clientName };
  if (label !== undefined) out.label = label;
  if (body.survey !== undefined) {
    out.survey = /** @type {Record<string, unknown>} */ (body.survey);
  }
  return out;
}

/**
 * @param {unknown} body
 * @returns {{ clientName?: string, label?: string | null, survey?: Record<string, unknown> }}
 */
export function validateProjectUpdateBody(body) {
  if (!isPlainObject(body)) {
    throwAppError('Тіло запиту має бути JSON-обʼєктом.', 'VALIDATION_ERROR', 400);
  }
  const hasClient = Object.prototype.hasOwnProperty.call(body, 'clientName');
  const hasLabel = Object.prototype.hasOwnProperty.call(body, 'label');
  const hasSurvey = Object.prototype.hasOwnProperty.call(body, 'survey');

  if (!hasClient && !hasLabel && !hasSurvey) {
    throwAppError(
      'Вкажіть хоча б одне поле: clientName, label або survey.',
      'VALIDATION_ERROR',
      400,
    );
  }

  /** @type {{ clientName?: string, label?: string | null, survey?: Record<string, unknown> }} */
  const out = {};

  if (hasClient) {
    out.clientName = normalizeClientNameFromImport(body.clientName);
  }
  if (hasLabel) {
    if (body.label === null) {
      out.label = null;
    } else {
      out.label = normalizeLabelFromImport(body.label) ?? null;
    }
  }
  if (hasSurvey) {
    assertSurveyShape(body.survey);
    out.survey = /** @type {Record<string, unknown>} */ (body.survey);
  }

  return out;
}
