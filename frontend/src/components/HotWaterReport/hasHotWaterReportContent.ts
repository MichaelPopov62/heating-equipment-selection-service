/**
 * Назначение: Проверка наличия данных расчёта ГВС для UI.
 * Описание: Используется кнопкой отчёта на шаге «Горячая вода» (как hasUnderfloorHeatingReportContent для ТП).
 */

import type { ParsedHotWaterReport } from '../../types/hotWaterReport';

/**
 * @param hotWater
 * @returns {boolean}
 */
export function hasHotWaterReportContent(
  hotWater: ParsedHotWaterReport | null,
): boolean {
  if (hotWater == null) return false;
  return Number.isFinite(hotWater.peakFlowLps)
    && Number.isFinite(hotWater.hotWaterPowerKw);
}
