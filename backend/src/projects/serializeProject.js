/**
 * Назначение: сериализация документов проектов.
 * Описание: преобразование MongoDB-документов Project и Calculation в DTO для API списка,
 * деталей проекта и вложенных расчётов.
 */
import { sanitizeCalculationSummary } from './extractCalculationSummary.js';
import { isPlainObject } from '../utils/isPlainObject.js';

/**
 * @param {import('mongoose').Document | Record<string, unknown>} doc
 * @returns {Record<string, unknown>}
 */
function toPlainRecord(doc) {
  if (
    doc &&
    typeof doc === 'object' &&
    'toObject' in doc &&
    typeof /** @type {{ toObject?: () => unknown }} */ (doc).toObject === 'function'
  ) {
    const plain = /** @type {{ toObject: () => unknown }} */ (doc).toObject();
    return isPlainObject(plain) ? plain : {};
  }
  return isPlainObject(doc) ? doc : {};
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatTimestamp(value) {
  return value instanceof Date ? value.toISOString() : String(value ?? '');
}

/**
 * @param {import('mongoose').Document | Record<string, unknown>} doc
 * @returns {import('../types/shared-types.js').ProjectListItem}
 */
export function serializeProjectListItem(doc) {
  const rec = toPlainRecord(doc);
  const id = String(rec._id ?? '');

  /** @type {import('../types/shared-types.js').ProjectListItem} */
  const item = {
    id,
    clientName: String(rec.clientName ?? ''),
    createdAt: formatTimestamp(rec.createdAt),
    updatedAt: formatTimestamp(rec.updatedAt),
  };

  if (rec.label != null && rec.label !== '') {
    item.label = String(rec.label);
  }
  if (typeof rec.calculationsCount === 'number') {
    item.calculationsCount = rec.calculationsCount;
  }

  return item;
}

/**
 * @param {import('mongoose').Document | Record<string, unknown>} doc
 * @param {{ calculationsCount?: number, lastCalculation?: import('../types/shared-types.js').CalculationListItem | null }} [extra]
 * @returns {import('../types/shared-types.js').ProjectDetail}
 */
export function serializeProjectDetail(doc, extra = {}) {
  const rec = toPlainRecord(doc);
  const base = serializeProjectListItem(rec);

  /** @type {import('../types/shared-types.js').ProjectDetail} */
  const detail = { ...base };

  if (extra.calculationsCount !== undefined) {
    detail.calculationsCount = extra.calculationsCount;
  } else if (typeof rec.calculationsCount === 'number') {
    detail.calculationsCount = rec.calculationsCount;
  }
  if (rec.survey !== undefined && rec.survey !== null) {
    detail.survey = rec.survey;
  }
  if (rec.lastCalcInput !== undefined && rec.lastCalcInput !== null) {
    detail.lastCalcInput = /** @type {import('../types/shared-types.js').CalcRequestBody} */ (
      /** @type {unknown} */ (rec.lastCalcInput)
    );
  }
  if (extra.lastCalculation !== undefined && extra.lastCalculation !== null) {
    detail.lastCalculation = extra.lastCalculation;
  }

  return detail;
}

/**
 * @param {import('mongoose').Document | Record<string, unknown>} doc
 * @returns {import('../types/shared-types.js').CalculationListItem}
 */
export function serializeCalculationListItem(doc) {
  const rec = toPlainRecord(doc);
  return {
    id: String(rec._id ?? ''),
    projectId: String(rec.projectId ?? ''),
    summary: sanitizeCalculationSummary(rec.summary),
    createdAt: formatTimestamp(rec.createdAt),
  };
}

/**
 * @param {import('mongoose').Document | Record<string, unknown>} doc
 * @returns {import('../types/shared-types.js').CalculationDetail}
 */
export function serializeCalculationDetail(doc) {
  const rec = toPlainRecord(doc);
  return {
    ...serializeCalculationListItem(rec),
    calcInput: /** @type {import('../types/shared-types.js').CalcRequestBody} */ (
      /** @type {unknown} */ (rec.calcInput)
    ),
    report: /** @type {import('../types/shared-types.js').CalcReport} */ (
      /** @type {unknown} */ (rec.report)
    ),
  };
}
