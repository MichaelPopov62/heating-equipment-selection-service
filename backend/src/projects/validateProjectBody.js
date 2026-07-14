/**
 * Назначение: валидация тела запросов проектов.
 * Описание: проверка и нормализация clientName, label и survey при создании и обновлении проекта;
 * ограничение размера payload и санитизация строк.
 */
import { isPlainObject } from '../utils/isPlainObject.js';
import { sanitizeTrimAngleBrackets } from '../utils/sanitizeString.js';
import { MAX_SURVEY_JSON_CHARS } from './documentSizeLimits.js';
import { throwAppError } from '../utils/createAppError.js';

const MAX_CLIENT_NAME_LEN = 200;
const MAX_LABEL_LEN = 200;

/**
 * @param {unknown} survey
 */
function assertSurveyShape(survey) {
  if (survey === undefined || survey === null) return;
  if (!isPlainObject(survey)) {
    throwAppError('Поле survey должно быть объектом.', 'VALIDATION_ERROR', 400);
  }
  const serialized = JSON.stringify(survey);
  if (serialized.length > MAX_SURVEY_JSON_CHARS) {
    throwAppError('Слишком большой объект survey.', 'PAYLOAD_TOO_LARGE', 413);
  }
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeClientName(raw) {
  const name = sanitizeTrimAngleBrackets(raw);
  if (!name) {
    throwAppError('Укажите имя клиента (clientName).', 'VALIDATION_ERROR', 400);
  }
  if (name.length > MAX_CLIENT_NAME_LEN) {
    throwAppError(
      `Имя клиента не длиннее ${MAX_CLIENT_NAME_LEN} символов.`,
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
function normalizeLabel(raw) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const label = sanitizeTrimAngleBrackets(raw);
  if (!label) return undefined;
  if (label.length > MAX_LABEL_LEN) {
    throwAppError(
      `Подпись объекта не длиннее ${MAX_LABEL_LEN} символов.`,
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
    throwAppError('Тело запроса должно быть JSON-объектом.', 'VALIDATION_ERROR', 400);
  }
  const clientName = normalizeClientName(body.clientName);
  const label = normalizeLabel(body.label);
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
    throwAppError('Тело запроса должно быть JSON-объектом.', 'VALIDATION_ERROR', 400);
  }
  const hasClient = Object.prototype.hasOwnProperty.call(body, 'clientName');
  const hasLabel = Object.prototype.hasOwnProperty.call(body, 'label');
  const hasSurvey = Object.prototype.hasOwnProperty.call(body, 'survey');

  if (!hasClient && !hasLabel && !hasSurvey) {
    throwAppError(
      'Укажите хотя бы одно поле: clientName, label или survey.',
      'VALIDATION_ERROR',
      400,
    );
  }

  /** @type {{ clientName?: string, label?: string | null, survey?: Record<string, unknown> }} */
  const out = {};

  if (hasClient) {
    out.clientName = normalizeClientName(body.clientName);
  }
  if (hasLabel) {
    if (body.label === null) {
      out.label = null;
    } else {
      out.label = normalizeLabel(body.label) ?? null;
    }
  }
  if (hasSurvey) {
    assertSurveyShape(body.survey);
    out.survey = /** @type {Record<string, unknown>} */ (body.survey);
  }

  return out;
}
