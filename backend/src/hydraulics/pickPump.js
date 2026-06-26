/**
 * Назначение: подбор циркуляционного насоса по H_system(Q).
 * Описание: H_pump(Q) = a·Q² + b·Q + c из operatingModes каталога.
 */

import { round } from '../utils/math.js';

/**
 * @param {object} coeffs
 * @param {number} qM3h
 * @returns {number}
 */
function pumpHeadM(coeffs, qM3h) {
  const a = Number(coeffs.a) || 0;
  const b = Number(coeffs.b) || 0;
  const c = Number(coeffs.c) || 0;
  return a * qM3h * qM3h + b * qM3h + c;
}

/**
 * @param {object} args
 * @param {number} args.designFlowM3PerHour
 * @param {number} args.headRequiredM
 * @param {import('../catalog/types').NormalizedCatalog['pumps']} args.pumps
 * @param {number} args.headMarginPercent
 * @returns {{ pump: import('./types').HydraulicsPumpMatch | null; warnings: string[] }}
 */
export function pickPumpForSystem({
  designFlowM3PerHour,
  headRequiredM,
  pumps,
  headMarginPercent,
}) {
  /** @type {string[]} */
  const warnings = [];
  const q = designFlowM3PerHour;
  const headTarget = headRequiredM * (1 + headMarginPercent / 100);

  if (q <= 0 || headRequiredM <= 0) {
    return { pump: null, warnings: ['Насос не подобран: нулевой расход или напор.'] };
  }

  if (!pumps?.length) {
    return { pump: null, warnings: ['Каталог насосов пуст — подбор невозможен.'] };
  }

  /** @type {import('./types').HydraulicsPumpMatch | null} */
  let best = null;

  for (const pump of pumps) {
    if (pump.type === 'circulation_hot_water') continue;

    for (const mode of pump.operatingModes ?? []) {
      const qMin = mode.qMinM3h ?? 0;
      const qMax = mode.qMaxM3h ?? Infinity;
      if (q < qMin || q > qMax) continue;

      const headAtQ = pumpHeadM(mode.coefficients, q);
      if (headAtQ >= headTarget) {
        const margin = ((headAtQ - headRequiredM) / headRequiredM) * 100;
        const candidate = {
          catalogPumpId: pump.id,
          modeName: mode.modeName,
          headMarginPercent: round(margin, 1),
          designFlowM3PerHour: q,
          headRequiredM: round(headRequiredM, 2),
          headAtDesignM: round(headAtQ, 2),
          warnings: [],
        };
        if (
          !best
          || candidate.headMarginPercent < best.headMarginPercent
        ) {
          best = candidate;
        }
      }
    }
  }

  if (!best) {
    warnings.push(
      `Не найден насос для Q=${q} м³/ч и H≥${round(headTarget, 2)} м — расширьте каталог или снизьте сопротивления.`,
    );
    return { pump: null, warnings };
  }

  return { pump: best, warnings };
}
