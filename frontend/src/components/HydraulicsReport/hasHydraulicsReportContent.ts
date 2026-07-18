/**
 * Призначення: перевірка наявності даних гідравліки для UI.
 * Опис: Кнопка звіту на кроці «Гидравлика» та summary в сайдбарі.
 */

import type { ParsedHydraulicsView } from '../../types/hydraulics';

/**
 * Чи є дані для показу звіту / summary гідравліки.
 *
 * @param hydraulics
 */
export function hasHydraulicsReportContent(
  hydraulics: ParsedHydraulicsView | null | undefined,
): boolean {
  if (hydraulics == null) return false;
  return hydraulics.hasData;
}
