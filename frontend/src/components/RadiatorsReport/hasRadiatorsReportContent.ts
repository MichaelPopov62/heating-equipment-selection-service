/**
 * Призначення: перевірка наявності даних matching.radiators для UI.
 * Опис: Кнопка звіту на кроці «Радіатори» та summary в сайдбарі.
 */

import type { ParsedRadiatorsMatching } from '../../utils/parseRadiatorsMatchingFromReport';
import { isRadiatorsMatchingSkipped } from '../../utils/radiatorsSkip';

/**
 * Чи є дані для показу звіту / summary радіаторів (включно зі skip ufh_only).
 *
 * @param radiators
 */
export function hasRadiatorsReportContent(
  radiators: ParsedRadiatorsMatching | null | undefined,
): boolean {
  if (radiators == null) return false;
  if (isRadiatorsMatchingSkipped(radiators)) return true;
  if (radiators.byRoom.length > 0) return true;
  if (radiators.emittersSummary != null) return true;
  if (radiators.totalSections != null) return true;
  if (radiators.lineEconomy != null || radiators.lineEfficient != null) return true;
  if (radiators.warnings.length > 0) return true;
  if (radiators.chosenModel != null && radiators.chosenModel.length > 0) return true;
  return false;
}
