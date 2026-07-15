/**
 * Назначение: Проверка, есть ли данные для отчёта ТП.
 * Описание: Вынесено отдельно от View — react-refresh/only-export-components.
 */

import type { ParsedUnderfloorHeating } from '../../types/underfloorHeating';

/**
 * Есть ли данные для показа отчёта ТП (комнаты и/или warnings).
 *
 * @param report
 */
export function hasUnderfloorHeatingReportContent(
  report: ParsedUnderfloorHeating | null | undefined,
): boolean {
  if (report == null) return false;
  return report.rooms.length > 0 || report.warnings.length > 0;
}
