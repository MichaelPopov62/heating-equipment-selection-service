/**
 * Назначение: метаданные для audit-логов проектов.
 * Описание: безопасные срезы survey и lastCalcInput без дампа полного JSON в лог.
 */

import { isPlainObject } from '../utils/isPlainObject.js';

/**
 * @typedef {Object} SurveyAuditMeta
 * @property {boolean} present
 * @property {number} [bytes]
 * @property {string} [schemaVersion]
 * @property {number} [currentStep]
 * @property {number} [roomsCount]
 */

/**
 * @typedef {Object} CalcInputAuditMeta
 * @property {boolean} present
 * @property {string} [objectType]
 * @property {number} [roomsCount]
 * @property {number} [insideC]
 * @property {boolean} [hasLocation]
 */

/**
 * Метаданные черновика анкеты для логов (без PII и полного payload).
 *
 * @param {unknown} survey
 * @returns {SurveyAuditMeta}
 */
export function surveyAuditMeta(survey) {
  if (survey === undefined || survey === null) {
    return { present: false };
  }
  if (!isPlainObject(survey)) {
    return { present: true };
  }

  /** @type {SurveyAuditMeta} */
  const meta = { present: true };

  try {
    const serialized = JSON.stringify(survey);
    meta.bytes = serialized.length;
  } catch {
    /* ignore circular refs */
  }

  if (typeof survey.schemaVersion === 'string' && survey.schemaVersion.trim()) {
    meta.schemaVersion = survey.schemaVersion.trim();
  }
  if (typeof survey.currentStep === 'number' && Number.isFinite(survey.currentStep)) {
    meta.currentStep = Math.floor(survey.currentStep);
  }
  if (Array.isArray(survey.rooms)) {
    meta.roomsCount = survey.rooms.length;
  }

  return meta;
}

/**
 * Метаданные CalcInput для логов.
 *
 * @param {unknown} calcInput
 * @returns {CalcInputAuditMeta}
 */
export function calcInputAuditMeta(calcInput) {
  if (!isPlainObject(calcInput)) {
    return { present: false };
  }

  /** @type {CalcInputAuditMeta} */
  const meta = { present: true };

  const building = calcInput.building;
  if (isPlainObject(building)) {
    const temps = building.temps;
    if (isPlainObject(temps) && typeof temps.insideC === 'number' && Number.isFinite(temps.insideC)) {
      meta.insideC = temps.insideC;
    }
    if (Array.isArray(building.rooms)) {
      meta.roomsCount = building.rooms.length;
    }
    const objectMeta = building.objectMeta;
    if (isPlainObject(objectMeta)) {
      const objectType = objectMeta.objectType;
      if (objectType === 'house' || objectType === 'apartment') {
        meta.objectType = objectType;
      }
    }
  }

  meta.hasLocation = isPlainObject(calcInput.location);

  return meta;
}

/**
 * Список полей, явно переданных в patch обновления проекта.
 *
 * @param {Record<string, unknown>} patch
 * @returns {('clientName' | 'label' | 'survey')[]}
 */
export function projectPatchFields(patch) {
  /** @type {('clientName' | 'label' | 'survey')[]} */
  const fields = [];
  if (Object.prototype.hasOwnProperty.call(patch, 'clientName')) fields.push('clientName');
  if (Object.prototype.hasOwnProperty.call(patch, 'label')) fields.push('label');
  if (Object.prototype.hasOwnProperty.call(patch, 'survey')) fields.push('survey');
  return fields;
}
