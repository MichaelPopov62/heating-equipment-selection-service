/**
 * Назначение: выбор терминала петли ТП (коллектор vs унибокс) в анкете.
 * Описание: унибокс только для зон ≤ UFH_TERMINAL_CONTROL_MAX_AREA_SQM м².
 */

/** Макс. площадь комнаты (м²), при которой допускается ufhTerminalControl=unibox. */
export const UFH_TERMINAL_CONTROL_MAX_AREA_SQM = 20;

/**
 * @param {unknown} raw
 * @returns {raw is 'collector' | 'unibox'}
 */
export function isUfhTerminalControl(raw) {
  return raw === 'collector' || raw === 'unibox';
}

/**
 * Нормализация выбора терминала: unibox только при areaM2 ≤ 20; иначе collector.
 *
 * @param {unknown} raw
 * @param {number} roomAreaM2
 * @returns {'collector' | 'unibox'}
 */
export function resolveUfhTerminalControl(raw, roomAreaM2) {
  const area = Number(roomAreaM2);
  const allowUnibox =
    Number.isFinite(area) && area > 0 && area <= UFH_TERMINAL_CONTROL_MAX_AREA_SQM;
  if (raw === 'unibox' && allowUnibox) return 'unibox';
  return 'collector';
}
