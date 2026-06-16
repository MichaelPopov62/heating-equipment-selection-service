/**
 * Назначение: поправка теплопотерь по ориентации ограждений.
 * Описание: Задаёт коэффициент β по сторонам света (СНiП 2.04.05-91 / СП 60.13330) и множитель (1 + β) для стен и окон. Экспортирует ORIENTATION_BETA, ORIENTATION_KINDS и heatLossFactorForEnvelopeKind(). Вызывается из heatlossByRooms.js при расчёте Q по элементам.
 */

/** @type {Readonly<Record<string, number>>} */
export const ORIENTATION_BETA = Object.freeze({
  N: 0.1,
  NE: 0.1,
  E: 0.1,
  NW: 0.05,
  W: 0.05,
  SE: 0.05,
  S: 0,
  SW: 0,
});

/** Элементы ограждения, для которых учитывается β по сторонам света. */
export const ORIENTATION_KINDS = Object.freeze(new Set(['wall', 'window']));

/**
 * β по ориентации (0…0.1).
 *
 * @param {string | null | undefined} orientation
 * @returns {number}
 */
function orientationBeta(orientation) {
  const o = String(orientation ?? '').toUpperCase();
  return ORIENTATION_BETA[o] ?? 0;
}

/**
 * Множитель теплопотерь (1 + β).
 *
 * @param {string | null | undefined} orientation
 * @returns {number}
 */
function orientationHeatLossFactor(orientation) {
  return 1 + orientationBeta(orientation);
}

/**
 * @param {string | null | undefined} kind
 * @param {string | null | undefined} orientation
 * @returns {number}
 */
export function heatLossFactorForEnvelopeKind(kind, orientation) {
  if (!ORIENTATION_KINDS.has(String(kind ?? ''))) return 1;
  return orientationHeatLossFactor(orientation);
}
