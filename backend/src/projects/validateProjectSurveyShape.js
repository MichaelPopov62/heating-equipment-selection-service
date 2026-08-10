/**
 * Назначение: проверка размера и формы поля survey проекта.
 */

import { isPlainObject } from '../utils/isPlainObject.js';
import { throwAppError } from '../utils/createAppError.js';
import { ERROR_CODES } from '../api/errorCodes.js';
import { MAX_SURVEY_JSON_CHARS } from './documentSizeLimits.js';

/**
 * @param {unknown} survey
 */
export function assertSurveyShape(survey) {
  if (survey === undefined || survey === null) return;
  if (!isPlainObject(survey)) {
    throwAppError('Поле survey має бути обʼєктом.', ERROR_CODES.VALIDATION_ERROR, 400);
  }
  const serialized = JSON.stringify(survey);
  if (serialized.length > MAX_SURVEY_JSON_CHARS) {
    throwAppError('Занадто великий обʼєкт survey.', 'PAYLOAD_TOO_LARGE', 413);
  }
}
