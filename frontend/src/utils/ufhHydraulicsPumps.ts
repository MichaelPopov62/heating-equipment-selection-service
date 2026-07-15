/**
 * Назначение: фильтр зональных насосов контура ТП из proposal.pumps.
 * Описание: SSOT — в отчёте ТП только ufh_* зоны; котловой насос не дублируется.
 */

import type { ParsedHydraulicsPumpProposal } from '../types/hydraulics';

const UFH_ZONE_IDS = new Set(['ufh_floor', 'ufh_floor_secondary']);

/**
 * Насос отдельного контура тёплого пола (смеситель / вторичка).
 *
 * @param pump
 */
export function isUfhZonePump(pump: ParsedHydraulicsPumpProposal): boolean {
  return UFH_ZONE_IDS.has(pump.zoneId);
}

/**
 * Зональные насосы ТП из списка гидравлики (без котлового / радиаторного).
 *
 * @param pumps
 */
export function selectUfhZonePumps(
  pumps: readonly ParsedHydraulicsPumpProposal[] | null | undefined,
): ParsedHydraulicsPumpProposal[] {
  if (pumps == null || pumps.length === 0) return [];
  return pumps.filter(isUfhZonePump);
}

/**
 * Насосы для блока гидравлики в «Итоге» — без зон ТП (они в отчёте шага ТП).
 *
 * @param pumps
 */
export function excludeUfhZonePumps(
  pumps: readonly ParsedHydraulicsPumpProposal[] | null | undefined,
): ParsedHydraulicsPumpProposal[] {
  if (pumps == null || pumps.length === 0) return [];
  return pumps.filter((p) => !isUfhZonePump(p));
}

/**
 * Краткая подпись насоса ТП для таблицы-итога.
 *
 * @param mixingRequired
 * @param ufhPumps
 */
export function ufhPumpSummaryLabel(
  mixingRequired: boolean,
  ufhPumps: readonly ParsedHydraulicsPumpProposal[],
): string {
  if (!mixingRequired) {
    return 'не требуется (насос котла)';
  }
  if (ufhPumps.length === 0) {
    return 'требуется, не подобран';
  }
  return ufhPumps
    .map((p) => `${p.brand} ${p.model}`.trim())
    .filter(Boolean)
    .join('; ');
}
