/**
 * Назначение: валидация тела запросов проектов.
 * Описание: проверка и нормализация clientName, label и survey при создании и обновлении проекта;
 * ограничение размера payload и санитизация строк.
 */
import { sanitizeTrimAngleBrackets } from '../utils/sanitizeString.js';

const MAX_CLIENT_NAME_LEN = 200;
const MAX_LABEL_LEN = 200;
/** Лимит размера survey в JSON (символы), защита от слишком больших payload. */
const MAX_SURVEY_JSON_CHARS = 512_000;

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} survey
 */
function assertSurveyShape(survey) {
  if (survey === undefined || survey === null) return;
  if (!isPlainObject(survey)) {
    const err = new Error('Поле survey должно быть объектом.');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const serialized = JSON.stringify(survey);
  if (serialized.length > MAX_SURVEY_JSON_CHARS) {
    const err = new Error('Слишком большой объект survey.');
    err.statusCode = 413;
    err.code = 'PAYLOAD_TOO_LARGE';
    throw err;
  }
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeClientName(raw) {
  const name = sanitizeTrimAngleBrackets(raw);
  if (!name) {
    const err = new Error('Укажите имя клиента (clientName).');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (name.length > MAX_CLIENT_NAME_LEN) {
    const err = new Error(`Имя клиента не длиннее ${MAX_CLIENT_NAME_LEN} символов.`);
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
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
    const err = new Error(`Подпись объекта не длиннее ${MAX_LABEL_LEN} символов.`);
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  return label;
}

/**
 * @param {unknown} body
 * @returns {{ clientName: string, label?: string, survey?: Record<string, unknown> }}
 */
export function validateProjectCreateBody(body) {
  if (!isPlainObject(body)) {
    const err = new Error('Тело запроса должно быть JSON-объектом.');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const clientName = normalizeClientName(body.clientName);
  const label = normalizeLabel(body.label);
  assertSurveyShape(body.survey);
  return {
    clientName,
    label,
    survey: body.survey === undefined ? undefined : /** @type {Record<string, unknown>} */ (body.survey),
  };
}

/**
 * @param {unknown} body
 * @returns {{ clientName?: string, label?: string | null, survey?: Record<string, unknown> }}
 */
export function validateProjectUpdateBody(body) {
  if (!isPlainObject(body)) {
    const err = new Error('Тело запроса должно быть JSON-объектом.');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  const hasClient = Object.prototype.hasOwnProperty.call(body, 'clientName');
  const hasLabel = Object.prototype.hasOwnProperty.call(body, 'label');
  const hasSurvey = Object.prototype.hasOwnProperty.call(body, 'survey');

  if (!hasClient && !hasLabel && !hasSurvey) {
    const err = new Error('Укажите хотя бы одно поле: clientName, label или survey.');
    err.statusCode = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
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
      out.label = normalizeLabel(body.label);
    }
  }
  if (hasSurvey) {
    assertSurveyShape(body.survey);
    out.survey = /** @type {Record<string, unknown>} */ (body.survey);
  }

  return out;
}
