/**
 * Назначение: Проверка наличия данных для блока «Горячая вода (итог)» в сайдбаре.
 */

import type { ParsedHotWaterReport } from '../../types/hotWaterReport';
import type { ParsedIndirectWaterHeaterMatching } from '../../utils/parseIndirectWaterHeaterMatchingFromReport';
import type { ParsedWaterHeaterMatching } from '../../utils/parseWaterHeaterMatchingFromReport';

/**
 * @param hotWater
 * @param electric
 * @param indirect
 * @returns {boolean}
 */
export function hasHotWaterSummaryContent(
  hotWater: ParsedHotWaterReport | null,
  electric: ParsedWaterHeaterMatching | null,
  indirect: ParsedIndirectWaterHeaterMatching | null,
): boolean {
  return hotWater != null || electric != null || indirect != null;
}
