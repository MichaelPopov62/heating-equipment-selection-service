/**
 * Призначення: перевірка наявності даних matching.boiler для UI.
 * Опис: Кнопка звіту на кроці «Котёл» та summary в сайдбарі.
 */

import type { ParsedBoilerMatching } from '../../utils/parsers/parseBoilerFromReport';

/**
 * Чи є дані для показу звіту / summary котла.
 *
 * @param boiler
 */
export function hasBoilerReportContent(
  boiler: ParsedBoilerMatching | null | undefined,
): boolean {
  if (boiler == null) return false;
  if (boiler.summary != null) return true;
  if (boiler.tierEconomy != null || boiler.tierEfficient != null) return true;
  if (boiler.legacyProposal != null) return true;
  if (boiler.warnings.length > 0) return true;
  return false;
}
