/**
 * Назначение: Проверка наличия данных подбора водонагревателя для UI.
 * Описание: Используется кнопкой отчёта на шаге «Водонагреватель» (как hasHotWaterReportContent для ГВ).
 */

import type { ParsedIndirectWaterHeaterMatching } from '../../utils/parseIndirectWaterHeaterMatchingFromReport';
import type { ParsedWaterHeaterMatching } from '../../utils/parseWaterHeaterMatchingFromReport';

/**
 * @param indirect — matching.indirectWaterHeater
 * @param electric — matching.waterHeater
 * @returns {boolean}
 */
export function hasWaterHeaterReportContent(
  indirect: ParsedIndirectWaterHeaterMatching | null,
  electric: ParsedWaterHeaterMatching | null,
): boolean {
  return indirect != null || electric != null;
}
