/**
 * Назначение: сопротивление внедрения трубы в стяжку по шагу укладки.
 * Описание: Дополнение к rScreedHalf (δ/2λ бетона). Калибровка: шаг 150 мм → 0.1 м²·K/Вт.
 */

/** @type {Readonly<Record<number, number>>} */
export const R_PIPE_EMBEDMENT_BY_STEP_MM = Object.freeze({
  100: 0.063,
  150: 0.1,
  200: 0.144,
});

/** @type {readonly number[]} */
export const ALLOWED_PIPE_SPACING_MM = Object.freeze([100, 150, 200]);

export const DEFAULT_PIPE_SPACING_MM = 150;

/**
 * @param {number} pipeSpacingMm
 * @returns {boolean}
 */
export function isAllowedPipeSpacingMm(pipeSpacingMm) {
  return ALLOWED_PIPE_SPACING_MM.includes(pipeSpacingMm);
}

/**
 * R_embed — сопротивление «труба → равномерная плоскость стяжки», м²·K/Вт.
 *
 * @param {number} pipeSpacingMm
 * @returns {number}
 */
export function resolvePipeEmbedmentResistanceM2KW(pipeSpacingMm) {
  const key = isAllowedPipeSpacingMm(pipeSpacingMm)
    ? pipeSpacingMm
    : DEFAULT_PIPE_SPACING_MM;
  const value = R_PIPE_EMBEDMENT_BY_STEP_MM[key]
    ?? R_PIPE_EMBEDMENT_BY_STEP_MM[DEFAULT_PIPE_SPACING_MM];
  if (value === undefined) {
    throw new Error(`ufhPipeEmbedment: немає R для шага ${key} мм`);
  }
  return value;
}
