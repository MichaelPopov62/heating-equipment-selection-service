/**
 * Назначение: подбор циркуляционного насоса по H_system(Q).
 * Описание: H_pump(Q) = a·Q² + b·Q + c из operatingModes каталога.
 */

import { pumpHeadM } from '../utils/pumpCurveMath.js';
import { round } from '../utils/math.js';

export { pumpHeadM };

/**
 * @typedef {'out_of_flow_range' | 'near_qmax' | 'negative_or_tiny_head' | 'insufficient_head' | 'head_oversized'} PumpDutyIssue
 */

/**
 * @param {import('./types').HydraulicsRules} rules
 * @returns {import('./types').HydraulicsPumpDutyRules}
 */
export function pumpDutyRulesFromHydraulicsRules(rules) {
  return {
    pumpHeadMarginPercent: rules.pumpHeadMarginPercent,
    pumpDutyQMaxUtilizationPercent: rules.pumpDutyQMaxUtilizationPercent,
    pumpMinHeadAtDutyM: rules.pumpMinHeadAtDutyM,
    pumpMaxHeadMarginPercent: rules.pumpMaxHeadMarginPercent,
  };
}

/**
 * @param {object} args
 * @param {{ qMinM3h?: number; qMaxM3h?: number; coefficients: object }} args.mode
 * @param {number} args.q
 * @param {number} args.headRequiredM
 * @param {number} args.headTarget
 * @param {import('./types').HydraulicsPumpDutyRules} args.dutyRules
 * @returns {{ ok: boolean; headAtQ?: number; marginPercent?: number; issue?: PumpDutyIssue }}
 */
export function evaluatePumpModeAtDuty({
  mode,
  q,
  headRequiredM,
  headTarget,
  dutyRules,
}) {
  const qMin = mode.qMinM3h ?? 0;
  const qMax = mode.qMaxM3h ?? Infinity;

  if (q < qMin || q > qMax) {
    return { ok: false, issue: 'out_of_flow_range' };
  }

  const qMaxUtil = dutyRules.pumpDutyQMaxUtilizationPercent / 100;
  if (q > qMax * qMaxUtil) {
    return { ok: false, issue: 'near_qmax' };
  }

  const headAtQ = pumpHeadM(mode.coefficients, q);
  if (headAtQ < dutyRules.pumpMinHeadAtDutyM) {
    return { ok: false, issue: 'negative_or_tiny_head' };
  }
  if (headAtQ < headTarget) {
    return { ok: false, issue: 'insufficient_head' };
  }

  const margin = ((headAtQ - headRequiredM) / headRequiredM) * 100;
  if (margin > dutyRules.pumpMaxHeadMarginPercent) {
    return { ok: false, issue: 'head_oversized' };
  }

  return { ok: true, headAtQ, marginPercent: margin };
}

/**
 * @param {object} args
 * @param {number} args.designFlowM3PerHour
 * @param {number} args.headRequiredM
 * @param {import('../catalog/types').NormalizedCatalog['pumps']} args.pumps
 * @param {import('./types').HydraulicsPumpDutyRules} args.dutyRules
 * @returns {{ pump: import('./types').HydraulicsPumpMatch | null; warnings: string[] }}
 */
export function pickPumpForSystem({
  designFlowM3PerHour,
  headRequiredM,
  pumps,
  dutyRules,
}) {
  /** @type {string[]} */
  const warnings = [];
  const q = designFlowM3PerHour;
  const headTarget = headRequiredM * (1 + dutyRules.pumpHeadMarginPercent / 100);

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
      const evalResult = evaluatePumpModeAtDuty({
        mode,
        q,
        headRequiredM,
        headTarget,
        dutyRules,
      });
      if (!evalResult.ok || evalResult.headAtQ == null || evalResult.marginPercent == null) {
        continue;
      }

      const candidate = {
        catalogPumpId: pump.id,
        modeName: mode.modeName,
        headMarginPercent: round(evalResult.marginPercent, 1),
        designFlowM3PerHour: q,
        headRequiredM: round(headRequiredM, 2),
        headAtDesignM: round(evalResult.headAtQ, 2),
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

  if (!best) {
    warnings.push(
      `Не найден насос для Q=${q} м³/ч и H≥${round(headTarget, 2)} м `
      + `(допустимая зона: Q≤${dutyRules.pumpDutyQMaxUtilizationPercent} % Q_max режима, `
      + `запас по напору ${dutyRules.pumpHeadMarginPercent}…${dutyRules.pumpMaxHeadMarginPercent} %) — `
      + 'расширьте каталог или снизьте сопротивления.',
    );
    return { pump: null, warnings };
  }

  return { pump: best, warnings };
}

/**
 * Проверка кривой насоса (котёл или каталог) в рабочей точке.
 *
 * @param {object} args
 * @param {Array<{ modeName: string; qMinM3h?: number; qMaxM3h?: number; coefficients: object }>} args.operatingModes
 * @param {number} args.designFlowM3PerHour
 * @param {number} args.headRequiredM
 * @param {import('./types').HydraulicsPumpDutyRules} args.dutyRules
 * @returns {{ ok: boolean; modeName?: string; headAtDesignM?: number; headMarginPercent?: number }}
 */
export function evaluatePumpCurveAtDuty({
  operatingModes,
  designFlowM3PerHour,
  headRequiredM,
  dutyRules,
}) {
  const q = designFlowM3PerHour;
  const headTarget = headRequiredM * (1 + dutyRules.pumpHeadMarginPercent / 100);

  if (q <= 0 || headRequiredM <= 0 || !operatingModes?.length) {
    return { ok: false };
  }

  /** @type {{ modeName: string; headAtDesignM: number; headMarginPercent: number } | null} */
  let best = null;

  for (const mode of operatingModes) {
    const evalResult = evaluatePumpModeAtDuty({
      mode,
      q,
      headRequiredM,
      headTarget,
      dutyRules,
    });
    if (!evalResult.ok || evalResult.headAtQ == null || evalResult.marginPercent == null) {
      continue;
    }

    const candidate = {
      modeName: mode.modeName,
      headAtDesignM: round(evalResult.headAtQ, 2),
      headMarginPercent: round(evalResult.marginPercent, 1),
    };
    if (!best || candidate.headMarginPercent < best.headMarginPercent) {
      best = candidate;
    }
  }

  if (!best) return { ok: false };

  return {
    ok: true,
    modeName: best.modeName,
    headAtDesignM: best.headAtDesignM,
    headMarginPercent: best.headMarginPercent,
  };
}
