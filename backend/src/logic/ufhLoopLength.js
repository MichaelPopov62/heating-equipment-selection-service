/**
 * Назначение: SSOT длины укладки трубы ТП (норма на 1 м² и суммарная длина).
 * Описание: L = S × (layoutFactor / a); классика layoutFactor = 1.1 (повороты/подводы).
 */

/** Классический коэффициент укладки (повороты), если в appliances не передали. */
export const UFH_LOOP_LENGTH_LAYOUT_FACTOR_DEFAULT = 1.1;

/**
 * Норма укладки трубы, м.п. на 1 м² активной площади.
 *
 * @param {number} pipeSpacingMm
 * @param {number} [layoutFactor=UFH_LOOP_LENGTH_LAYOUT_FACTOR_DEFAULT]
 * @returns {number}
 */
export function ufhPipeMetersPerSqM(
  pipeSpacingMm,
  layoutFactor = UFH_LOOP_LENGTH_LAYOUT_FACTOR_DEFAULT,
) {
  const spacingM = Math.max(0.05, (Number(pipeSpacingMm) || 150) / 1000);
  const factor = Number(layoutFactor);
  const f =
    Number.isFinite(factor) && factor >= 1
      ? factor
      : UFH_LOOP_LENGTH_LAYOUT_FACTOR_DEFAULT;
  return f / spacingM;
}

/**
 * Суммарная длина трубы ТП по активной площади (до деления на петли).
 *
 * @param {object} args
 * @param {number} args.areaM2 — S_акт
 * @param {number} args.pipeSpacingMm
 * @param {number} [args.layoutFactor]
 * @returns {number}
 */
export function computeUfhLoopTotalLengthM({
  areaM2,
  pipeSpacingMm,
  layoutFactor = UFH_LOOP_LENGTH_LAYOUT_FACTOR_DEFAULT,
}) {
  const area = Math.max(0, Number(areaM2) || 0);
  if (area <= 0) return 0;
  return area * ufhPipeMetersPerSqM(pipeSpacingMm, layoutFactor);
}
