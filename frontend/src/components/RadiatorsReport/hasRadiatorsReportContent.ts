/**
 * Призначення: перевірка наявності даних matching.radiators для UI.
 * Опис: Кнопка звіту на кроці «Радіатори» та summary в сайдбарі.
 */

import type { ParsedRadiatorsMatching } from '../../utils/parseRadiatorsMatchingFromReport';

/**
 * Чи є дані для показу звіту / summary радіаторів.
 *
 * @param radiators
 */
export function hasRadiatorsReportContent(
  radiators: ParsedRadiatorsMatching | null | undefined,
): boolean {
  if (radiators == null) return false;
  if (radiators.byRoom.length > 0) return true;
  if (radiators.emittersSummary != null) return true;
  if (radiators.totalSections != null) return true;
  if (radiators.lineEconomy != null || radiators.lineEfficient != null) return true;
  if (radiators.warnings.length > 0) return true;
  if (radiators.chosenModel != null && radiators.chosenModel.length > 0) return true;
  return false;
}
