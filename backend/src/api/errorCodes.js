/**
 * Назначение: канонические коды ErrorEnvelope.error.code для HTTP API.
 * Описание: SSOT строковых кодов; валидация входа — всегда VALIDATION_ERROR (400).
 */

export const ERROR_CODES = Object.freeze({
  /** AJV / body / query / ObjectId — ошибки ввода клиента */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** Неочікувана внутрішня помилка (клієнту при status 500, особливодк. у production) */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  CALCULATION_NOT_FOUND: 'CALCULATION_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  FEEDBACK_NOT_FOUND: 'FEEDBACK_NOT_FOUND',
});
