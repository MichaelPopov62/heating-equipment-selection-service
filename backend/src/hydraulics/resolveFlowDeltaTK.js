/**
 * Назначение: SSOT — ΔT для расчёта расхода Q = P/(c·ΔT).
 * Описание: Приоритет deltaTSystemK из анкеты; fallback — supplyC−returnC графика.
 */

/**
 * @param {object} args
 * @param {number | undefined} args.deltaTSystemK — input.hydraulics.deltaTSystemK
 * @param {number} args.supplyC
 * @param {number} args.returnC
 * @returns {number}
 */
export function resolveFlowDeltaTK({ deltaTSystemK, supplyC, returnC }) {
  if (typeof deltaTSystemK === 'number' && deltaTSystemK > 0) {
    return deltaTSystemK;
  }
  return Math.max(0.1, (Number(supplyC) || 0) - (Number(returnC) || 0));
}
