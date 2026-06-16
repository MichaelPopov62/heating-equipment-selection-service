/**
 * Назначение: запас на вентиляцию и инфильтрацию.
 * Описание: Задаёт режимы natural/recuperation и множитель kVent к теплопотерям через ограждения (MVP без отдельного расчёта 0,33·L·ΔT). Экспортирует normalizeVentilationReserveMode, resolveKVent и ventilationReserveModeLabel(). Используется в validate.js и heatlossByRooms.js.
 */

/** @typedef {'natural' | 'recuperation'} VentilationReserveMode */

/** kVent: естественная вентиляция / ручное проветривание. */
export const K_VENT_NATURAL = 1.3;

/** kVent: приточно-вытяжная установка с рекуператором. */
export const K_VENT_RECUPERATION = 1.1;

/**
 * @param {VentilationReserveMode | string | undefined | null} mode
 * @returns {VentilationReserveMode}
 */
export function normalizeVentilationReserveMode(mode) {
  if (mode === 'recuperation') return 'recuperation';
  return 'natural';
}

/**
 * @param {VentilationReserveMode | string | undefined | null} mode
 * @returns {number}
 */
export function resolveKVent(mode) {
  return normalizeVentilationReserveMode(mode) === 'recuperation'
    ? K_VENT_RECUPERATION
    : K_VENT_NATURAL;
}

/**
 * @param {VentilationReserveMode} mode
 * @returns {string}
 */
export function ventilationReserveModeLabel(mode) {
  return mode === 'recuperation'
    ? 'приточно-вытяжная с рекуператором'
    : 'естественная вентиляция / проветривание';
}
