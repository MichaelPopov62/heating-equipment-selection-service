/**
 * Назначение: сериализация документов проектов.
 * Описание: преобразование MongoDB-документов Project и Calculation в DTO для API списка,
 * деталей проекта и вложенных расчётов.
 */
import { sanitizeCalculationSummary } from './extractCalculationSummary.js';
/**
 * @param {import('mongoose').Document | Record<string, unknown>} doc
 * @returns {import('../types/shared-types').ProjectListItem}
 */
export function serializeProjectListItem(doc) {
  const id = String(doc._id);
  return {
    id,
    clientName: String(doc.clientName ?? ''),
    label: doc.label ? String(doc.label) : undefined,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ''),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt ?? ''),
    calculationsCount:
      typeof doc.calculationsCount === 'number' ? doc.calculationsCount : undefined,
  };
}

/**
 * @param {import('mongoose').Document | Record<string, unknown>} doc
 * @param {{ calculationsCount?: number, lastCalculation?: import('../types/shared-types').CalculationListItem | null }} [extra]
 * @returns {import('../types/shared-types').ProjectDetail}
 */
export function serializeProjectDetail(doc, extra = {}) {
  const base = serializeProjectListItem(doc);
  return {
    ...base,
    calculationsCount: extra.calculationsCount ?? base.calculationsCount,
    survey: doc.survey ?? undefined,
    lastCalcInput: doc.lastCalcInput ?? undefined,
    lastCalculation: extra.lastCalculation ?? undefined,
  };
}

/**
 * @param {import('mongoose').Document | Record<string, unknown>} doc
 * @returns {import('../types/shared-types').CalculationListItem}
 */
export function serializeCalculationListItem(doc) {
  return {
    id: String(doc._id),
    projectId: String(doc.projectId),
    summary: sanitizeCalculationSummary(doc.summary),
    createdAt:
      doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt ?? ''),
  };
}

/**
 * @param {import('mongoose').Document | Record<string, unknown>} doc
 * @returns {import('../types/shared-types').CalculationDetail}
 */
export function serializeCalculationDetail(doc) {
  return {
    ...serializeCalculationListItem(doc),
    calcInput: doc.calcInput,
    report: doc.report,
  };
}
