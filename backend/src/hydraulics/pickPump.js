/**
 * Назначение: подбор циркуляционного насоса по H_system(Q).
 * Описание: H_pump(Q) = a·Q² + b·Q + c из operatingModes каталога.
 */

import { pumpHeadM } from '../utils/pumpCurveMath.js';
import { round } from '../utils/math.js';

export { pumpHeadM };

/**
 * @typedef {'below_manufacturer_qmin' | 'curve_unavailable' | 'near_qmax' | 'negative_or_tiny_head' | 'insufficient_head' | 'head_oversized'} PumpDutyIssue
 */

/**
 * @typedef {'ok' | 'below_manufacturer_qmin' | 'curve_unavailable' | 'insufficient_head' | 'no_suitable_mode'} BuiltinPumpDutyStatus
 */

/**
 * @param {import('./types.js').HydraulicsRules} rules
 * @returns {import('./types.js').HydraulicsPumpDutyRules}
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
 * @param {Array<{ qMinM3h?: number }>} modes
 * @returns {number}
 */
export function resolveHeatingCircuitMinFlowM3h(modes) {
  /** @type {number[]} */
  const mins = [];
  for (const m of modes) {
    const v = m.qMinM3h;
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      mins.push(v);
    }
  }
  return mins.length ? Math.min(...mins) : 0;
}

/**
 * @param {object} args
 * @param {{ qMinM3h?: number; qMaxM3h?: number; coefficients: object }} args.mode
 * @param {number} args.q
 * @param {number} args.headRequiredM
 * @param {number} args.headTarget
 * @param {import('./types.js').HydraulicsPumpDutyRules} args.dutyRules
 * @param {boolean} [args.skipHeadOversizedCheck]
 * @param {boolean} [args.softQMin] — зона смесителя: Q &lt; qMin не отсекает режим
 * @returns {{
 *   ok: boolean;
 *   headAtQ?: number;
 *   marginPercent?: number;
 *   issue?: PumpDutyIssue;
 *   softQMinApplied?: boolean;
 * }}
 */
export function evaluatePumpModeAtDuty({
  mode,
  q,
  headRequiredM,
  headTarget,
  dutyRules,
  skipHeadOversizedCheck = false,
  softQMin = false,
}) {
  const qMin = mode.qMinM3h ?? 0;
  const qMax = mode.qMaxM3h ?? Infinity;

  let softQMinApplied = false;
  if (q < qMin) {
    if (!softQMin) {
      return { ok: false, issue: 'below_manufacturer_qmin' };
    }
    softQMinApplied = true;
  }
  if (q > qMax) {
    return { ok: false, issue: 'curve_unavailable' };
  }

  const qMaxUtil = dutyRules.pumpDutyQMaxUtilizationPercent / 100;
  if (q > qMax * qMaxUtil) {
    return { ok: false, issue: 'near_qmax' };
  }

  const headAtQ = pumpHeadM(mode.coefficients, q);
  if (headAtQ < dutyRules.pumpMinHeadAtDutyM) {
    return { ok: false, issue: 'curve_unavailable' };
  }
  if (headAtQ < headTarget) {
    return { ok: false, issue: 'insufficient_head' };
  }

  const margin = ((headAtQ - headRequiredM) / headRequiredM) * 100;
  if (!skipHeadOversizedCheck && margin > dutyRules.pumpMaxHeadMarginPercent) {
    return { ok: false, issue: 'head_oversized' };
  }

  return {
    ok: true,
    headAtQ,
    marginPercent: margin,
    ...(softQMinApplied ? { softQMinApplied: true } : {}),
  };
}

/**
 * Подбор насоса из каталога по рабочей точке.
 *
 * @param {object} args
 * @param {number} args.designFlowM3PerHour
 * @param {number} args.headRequiredM
 * @param {import('../catalog/types.js').NormalizedCatalog['pumps']} args.pumps
 * @param {import('./types.js').HydraulicsPumpDutyRules} args.dutyRules
 * @param {boolean} [args.softQMin] — допускать Q &lt; qMin (зона смесителя ТП)
 * @param {boolean} [args.skipHeadOversizedCheck] — не отсекать по запасу &gt; pumpMaxHeadMarginPercent
 * @param {boolean} [args.useExactHeadRequired] — H_target = H_req без +pumpHeadMarginPercent
 * @returns {{ pump: import('./types.js').HydraulicsPumpMatch | null; warnings: string[] }}
 */
export function pickPumpForSystem({
  designFlowM3PerHour,
  headRequiredM,
  pumps,
  dutyRules,
  softQMin = false,
  skipHeadOversizedCheck = false,
  useExactHeadRequired = false,
}) {
  /** @type {string[]} */
  const warnings = [];
  const q = designFlowM3PerHour;
  const headTarget = useExactHeadRequired
    ? headRequiredM
    : headRequiredM * (1 + dutyRules.pumpHeadMarginPercent / 100);

  if (q <= 0 || headRequiredM <= 0) {
    return { pump: null, warnings: ['Насос не подобран: нулевой расход или напор.'] };
  }

  if (!pumps?.length) {
    return { pump: null, warnings: ['Каталог насосов пуст — подбор невозможен.'] };
  }

  /** @type {import('./types.js').HydraulicsPumpMatch | null} */
  let best = null;
  let bestSoftQMin = false;

  for (const pump of pumps) {
    if (pump.type === 'circulation_hot_water') continue;

    for (const mode of pump.operatingModes ?? []) {
      const evalResult = evaluatePumpModeAtDuty({
        mode,
        q,
        headRequiredM,
        headTarget,
        dutyRules,
        skipHeadOversizedCheck,
        softQMin,
      });
      if (!evalResult.ok || evalResult.headAtQ == null || evalResult.marginPercent == null) {
        continue;
      }

      /** @type {string[]} */
      const candWarnings = [];
      if (evalResult.softQMinApplied) {
        const modeQMin = mode.qMinM3h ?? 0;
        candWarnings.push(
          `Расход Q=${q} м³/ч ниже паспортного q_min=${modeQMin} м³/ч режима «${mode.modeName}» — `
          + 'допущена работа у левого края кривой (зона смесительного узла).',
        );
      }

      const candidate = {
        catalogPumpId: pump.id,
        modeName: mode.modeName,
        headMarginPercent: round(evalResult.marginPercent, 1),
        designFlowM3PerHour: q,
        headRequiredM: round(headRequiredM, 2),
        headAtDesignM: round(evalResult.headAtQ, 2),
        warnings: candWarnings,
      };
      if (
        !best
        || candidate.headMarginPercent < best.headMarginPercent
      ) {
        best = candidate;
        bestSoftQMin = evalResult.softQMinApplied === true;
      }
    }
  }

  if (!best) {
    const marginHint = skipHeadOversizedCheck
      ? `H≥${round(headTarget, 2)} м (без потолка запаса по напору)`
      : `H≥${round(headTarget, 2)} м (запас по напору ${dutyRules.pumpHeadMarginPercent}…${dutyRules.pumpMaxHeadMarginPercent} %)`;
    warnings.push(
      `Не найден насос для Q=${q} м³/ч и ${marginHint} `
      + `(допустимая зона: Q≤${dutyRules.pumpDutyQMaxUtilizationPercent} % Q_max режима`
      + (softQMin ? ', soft qMin для зоны смесителя' : '')
      + ') — расширьте каталог или снизьте сопротивления.',
    );
    return { pump: null, warnings };
  }

  if (bestSoftQMin && best.warnings.length) {
    warnings.push(...best.warnings);
  }

  return { pump: best, warnings };
}

/**
 * Проверка кривой встроенного насоса котла в рабочей точке.
 *
 * @param {object} args
 * @param {Array<{ modeName: string; qMinM3h?: number; qMaxM3h?: number; coefficients: object }>} args.operatingModes
 * @param {number} args.designFlowM3PerHour
 * @param {number} args.headRequiredM
 * @param {import('./types.js').HydraulicsPumpDutyRules} args.dutyRules
 * @returns {import('./types.js').BuiltinPumpCurveEvaluation}
 */
export function evaluatePumpCurveAtDuty({
  operatingModes,
  designFlowM3PerHour,
  headRequiredM,
  dutyRules,
}) {
  const q = designFlowM3PerHour;
  const headTarget = headRequiredM * (1 + dutyRules.pumpHeadMarginPercent / 100);
  const heatingCircuitMinFlowM3h = resolveHeatingCircuitMinFlowM3h(operatingModes);

  if (q <= 0 || headRequiredM <= 0 || !operatingModes?.length) {
    return { ok: false, builtinPumpRecognized: false };
  }

  if (heatingCircuitMinFlowM3h > 0 && q < heatingCircuitMinFlowM3h) {
    return {
      ok: false,
      dutyStatus: 'below_manufacturer_qmin',
      heatingCircuitMinFlowM3h,
      builtinPumpRecognized: true,
    };
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
      skipHeadOversizedCheck: true,
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

  if (!best) {
    return {
      ok: false,
      dutyStatus: 'no_suitable_mode',
      heatingCircuitMinFlowM3h,
      builtinPumpRecognized: true,
    };
  }

  return {
    ok: true,
    dutyStatus: 'ok',
    modeName: best.modeName,
    headAtDesignM: best.headAtDesignM,
    headMarginPercent: best.headMarginPercent,
    heatingCircuitMinFlowM3h,
    builtinPumpRecognized: true,
  };
}
