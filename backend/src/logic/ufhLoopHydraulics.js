/**
 * Назначение: гидравлическая проверка петель ТП (СП 60.13330 / ГОСТ Р 70834-2023, MVP).
 * Описание: Расход по Q/(c·Δt), подбор трубы из каталога, v и Δp (Darcy + повороты 90°).
 * Автооптимизация: число петель (v ↔ Δp) и Ø (мин. номинал из appliances, типично 16 мм).
 */

import { pickPipeForEdge } from '../hydraulics/pickPipe.js';
import {
  computeSegmentHydraulics,
  pipeInternalDiameterMm,
  resolveRoughnessMm,
} from '../hydraulics/pipeHydraulics.js';
import { thermalLoadToFlow } from '../hydraulics/thermalLoadToFlow.js';
import { pushRecommendation } from '../recommendations/recommendationResolver.js';
import { round } from '../utils/math.js';
import {
  UFH_LOOP_LENGTH_LAYOUT_FACTOR_DEFAULT,
  computeUfhLoopTotalLengthM,
} from './ufhLoopLength.js';

const MAX_LOOPS_HEURISTIC = 32;

/**
 * Оценка числа поворотов 90° в контуре петли ТП (MVP: аппроксимация меандра).
 * @param {number} loopLengthM
 * @param {number} pipeSpacingMm
 * @returns {number}
 */
export function estimateUfhLoopElbowCount(loopLengthM, pipeSpacingMm) {
  const spacingM = Math.max(0.05, (Number(pipeSpacingMm) || 150) / 1000);
  const len = Math.max(0, Number(loopLengthM) || 0);
  if (len <= 0) return 0;
  const ratio = len / spacingM;
  if (ratio <= 0) return 2;
  return Math.max(2, Math.round(2 * Math.sqrt(ratio)));
}

/**
 * @param {import('../dhw/types.js').HydraulicsApplianceRulesDoc} rules
 * @returns {{ deltaTK: number; velocityMinMps: number; velocityMaxMps: number; maxPressureDropKPa: number }}
 */
export function ufhLoopHydraulicsThresholds(rules) {
  return {
    deltaTK: rules.ufhLoopDeltaTK,
    velocityMinMps: rules.ufhLoopVelocityMinMps,
    velocityMaxMps: rules.ufhLoopVelocityMaxMps,
    maxPressureDropKPa: rules.maxUfhLoopPressureDropKPa,
  };
}

/**
 * @param {import('../dhw/types.js').HydraulicsApplianceRulesDoc} rules
 * @returns {number}
 */
function ufhLoopMinNominalDiameterMm(rules) {
  const n = Number(rules.ufhLoopMinNominalDiameterMm);
  return Number.isFinite(n) && n > 0 ? n : 16;
}

/**
 * @param {object} args
 * @param {number} [args.heatFluxDownWm2]
 * @param {number} [args.heatFluxDownWatts]
 * @param {number} [args.heatFluxUpWatts]
 * @param {string} [args.bottomBoundary]
 * @param {import('../dhw/types.js').HydraulicsApplianceRulesDoc} args.hydraulicsRules
 * @returns {boolean}
 */
export function shouldTriggerUfhPipeResize({
  heatFluxDownWm2 = 0,
  heatFluxDownWatts = 0,
  heatFluxUpWatts = 0,
  bottomBoundary,
  hydraulicsRules,
}) {
  if (!hydraulicsRules.ufhLoopPipeResizeEnabled) return false;

  if (
    bottomBoundary === 'heated'
    && heatFluxDownWm2 >= hydraulicsRules.ufhParasiticDownTriggerWm2
  ) {
    return true;
  }

  if (
    heatFluxUpWatts > 0
    && heatFluxDownWatts / heatFluxUpWatts >= hydraulicsRules.ufhParasiticDownToUpRatio
  ) {
    return true;
  }

  return false;
}

/**
 * @param {import('../catalog/types.js').NormalizedCatalog['pipes']} pipes
 * @param {number} minNominalDiameterMm
 * @param {import('../hydraulics/types.js').HydraulicsSurveyInput['pipeMaterialPreference']} [materialPreference]
 * @returns {import('../catalog/types.js').PipeCatalogItemNormalized[]}
 */
function filterUfhPipePool(pipes, minNominalDiameterMm, materialPreference) {
  if (!pipes?.length) return [];

  const minNom = Math.max(1, minNominalDiameterMm);

  /** @type {import('../catalog/types.js').PipeCatalogItemNormalized[]} */
  let pool = pipes.filter((p) => (Number(p.diameter) || 0) >= minNom);

  if (materialPreference) {
    const pref = materialPreference.toLowerCase();
    const filtered = pool.filter((p) => {
      const m = String(p.material ?? '').toLowerCase();
      if (pref === 'pex') return m.includes('pex');
      if (pref === 'metal_plastic') {
        return m.includes('metal') || m.includes('pex-al') || m.includes('ал');
      }
      if (pref === 'steel') return m.includes('steel') || m.includes('сталь');
      return true;
    });
    if (filtered.length) pool = filtered;
  }

  pool.sort((a, b) => pipeInternalDiameterMm(a) - pipeInternalDiameterMm(b));
  return pool;
}

/**
 * @param {object} args
 * @param {import('../catalog/types.js').PipeCatalogItemNormalized} args.pipe
 * @param {number} args.loopLengthM
 * @param {number} args.flowRateM3PerHour
 * @param {number} args.localZeta
 * @param {import('../dhw/types.js').HydraulicsApplianceRulesDoc} args.hydraulicsRules
 * @returns {{ catalogPipeId: string; internalDiameterMm: number; velocityMps: number; pressureDropKPa: number } | null}
 */
function computeUfhLoopPipeHydraulics({
  pipe,
  loopLengthM,
  flowRateM3PerHour,
  localZeta,
  hydraulicsRules,
}) {
  if (loopLengthM <= 0 || flowRateM3PerHour <= 0) return null;

  const internalMm = pipeInternalDiameterMm(pipe);
  const roughness = resolveRoughnessMm(
    pipe.material,
    hydraulicsRules.roughnessMmByMaterial,
  );
  const hyd = computeSegmentHydraulics({
    flowM3PerHour: flowRateM3PerHour,
    lengthM: loopLengthM,
    internalDiameterMm: internalMm,
    roughnessMm: roughness,
    localZeta,
  });

  return {
    catalogPipeId: pipe.id,
    internalDiameterMm: internalMm,
    velocityMps: hyd.velocityMps,
    pressureDropKPa: hyd.pressureDropKPa,
  };
}

/**
 * @param {import('./ufhLoopHydraulics.types.js').UfhLoopHydraulicsResult} h
 * @param {{ velocityMinMps: number; velocityMaxMps: number; maxPressureDropKPa: number }} thresholds
 * @returns {boolean}
 */
function isLoopVelocityOk(h, thresholds) {
  return (
    h.velocityMps != null
    && h.velocityMps >= thresholds.velocityMinMps
    && h.velocityMps <= thresholds.velocityMaxMps
  );
}

/**
 * @param {import('./ufhLoopHydraulics.types.js').UfhLoopHydraulicsResult} h
 * @param {{ maxPressureDropKPa: number }} thresholds
 * @returns {boolean}
 */
function isLoopPressureOk(h, thresholds) {
  return (
    h.pressureDropKPa == null
    || h.pressureDropKPa <= thresholds.maxPressureDropKPa
  );
}

/**
 * @param {import('./ufhLoopHydraulics.types.js').UfhLoopHydraulicsResult[]} loopHydraulics
 * @param {{ velocityMinMps: number; velocityMaxMps: number; maxPressureDropKPa: number }} thresholds
 * @returns {{ pressureOk: boolean; velocityOk: boolean }}
 */
function evaluateLoopsHydraulics(loopHydraulics, thresholds) {
  const pressureOk = loopHydraulics.every((h) => isLoopPressureOk(h, thresholds));
  const velocityOk = loopHydraulics.every((h) => isLoopVelocityOk(h, thresholds));
  return { pressureOk, velocityOk };
}

/**
 * @param {import('./ufhLoopHydraulics.types.js').UfhLoopHydraulicsResult[]} loopHydraulics
 * @param {{ velocityMinMps: number; velocityMaxMps: number; maxPressureDropKPa: number }} thresholds
 * @returns {number}
 */
function scorePartialLoopsConfiguration(loopHydraulics, thresholds) {
  let score = 0;
  for (const h of loopHydraulics) {
    if (h.velocityMps == null || h.pressureDropKPa == null) {
      return Number.MAX_SAFE_INTEGER;
    }
    if (h.velocityMps < thresholds.velocityMinMps) {
      score += 1000 + (thresholds.velocityMinMps - h.velocityMps) * 100;
    } else if (h.velocityMps > thresholds.velocityMaxMps) {
      score += 500 + (h.velocityMps - thresholds.velocityMaxMps) * 100;
    }
    if (h.pressureDropKPa > thresholds.maxPressureDropKPa) {
      score += 800 + (h.pressureDropKPa - thresholds.maxPressureDropKPa) * 10;
    }
  }
  return score;
}

/**
 * @param {import('./ufhLoopHydraulics.types.js').UfhLoopHydraulicsResult[]} loopHydraulics
 * @param {{ velocityMinMps: number; velocityMaxMps: number; maxPressureDropKPa: number }} thresholds
 * @returns {import('./ufhLoopHydraulics.types.js').UfhLoopResolutionStatus}
 */
function deriveResolutionStatus(loopHydraulics, thresholds) {
  let hasLowVelocity = false;
  let hasHighVelocity = false;
  let hasHighPressure = false;

  for (const h of loopHydraulics) {
    if (h.velocityMps == null || h.pressureDropKPa == null) continue;
    if (h.velocityMps < thresholds.velocityMinMps) hasLowVelocity = true;
    if (h.velocityMps > thresholds.velocityMaxMps) hasHighVelocity = true;
    if (h.pressureDropKPa > thresholds.maxPressureDropKPa) hasHighPressure = true;
  }

  const velocityBad = hasLowVelocity || hasHighVelocity;

  if (!velocityBad && !hasHighPressure) {
    return 'resolved_auto';
  }
  if (velocityBad && hasHighPressure) {
    return 'unresolved_conflict';
  }
  if (hasHighPressure) {
    return 'unresolved_pressure';
  }
  return 'unresolved_velocity';
}

/**
 * @param {object} args
 * @param {number} args.loopsCount
 * @param {number} args.minLoopsGeom
 * @param {import('./ufhLoopHydraulics.types.js').UfhLoopHydraulicsResult[]} args.loopHydraulics
 * @returns {import('./ufhLoopHydraulics.types.js').UfhLoopAppliedFix}
 */
function deriveAppliedFix({ loopsCount, minLoopsGeom, loopHydraulics }) {
  if (loopsCount < minLoopsGeom) return 'loops_reduced';
  if (loopsCount > minLoopsGeom) return 'loops_increased';
  if (loopHydraulics.some((h) => h.pipeResizeAction === 'downsized')) {
    return 'pipe_downsized';
  }
  if (loopHydraulics.some((h) => h.pipeResizeAction === 'upsized')) {
    return 'pipe_upsized';
  }
  return 'none';
}

/**
 * @param {object} args
 * @param {import('../hydraulics/types.js').HydraulicsPipeMatchItem} args.defaultMatch
 * @param {import('../catalog/types.js').PipeCatalogItemNormalized[]} args.pool
 * @param {number} args.loopLengthM
 * @param {number} args.flowRateM3PerHour
 * @param {number} args.localZeta
 * @param {import('../dhw/types.js').HydraulicsApplianceRulesDoc} args.hydraulicsRules
 * @param {{ velocityMinMps: number; velocityMaxMps: number; maxPressureDropKPa: number }} args.thresholds
 * @param {string} args.loopId
 * @returns {{ finalMatch: import('../hydraulics/types.js').HydraulicsPipeMatchItem; pipeResizeAction: import('./ufhLoopHydraulics.types.js').UfhLoopPipeResizeAction; pipeResizeReason: string | null }}
 */
function optimizeUfhLoopPipe({
  defaultMatch,
  pool,
  loopLengthM,
  flowRateM3PerHour,
  localZeta,
  hydraulicsRules,
  thresholds,
  loopId,
}) {
  let finalMatch = defaultMatch;
  /** @type {import('./ufhLoopHydraulics.types.js').UfhLoopPipeResizeAction} */
  let pipeResizeAction = 'unchanged';
  /** @type {string | null} */
  let pipeResizeReason = null;

  if (!hydraulicsRules.ufhLoopPipeResizeEnabled || pool.length === 0) {
    return { finalMatch, pipeResizeAction, pipeResizeReason };
  }

  const pressureUtilThreshold =
    thresholds.maxPressureDropKPa * hydraulicsRules.ufhLoopPressureUtilizationForResize;

  const vLow = defaultMatch.velocityMps < thresholds.velocityMinMps;
  const vHigh = defaultMatch.velocityMps > thresholds.velocityMaxMps;
  const dpHigh = defaultMatch.pressureDropKPa > pressureUtilThreshold;

  if (vLow) {
    /** @type {import('./ufhLoopHydraulics.types.js').UfhLoopPipeCandidate | null} */
    let smallerCandidate = null;
    for (const pipe of pool) {
      const computed = computeUfhLoopPipeHydraulics({
        pipe,
        loopLengthM,
        flowRateM3PerHour,
        localZeta,
        hydraulicsRules,
      });
      if (!computed) continue;
      if (computed.velocityMps < thresholds.velocityMinMps) continue;
      if (computed.pressureDropKPa > thresholds.maxPressureDropKPa) continue;
      if (
        !smallerCandidate
        || computed.internalDiameterMm < smallerCandidate.internalDiameterMm
      ) {
        smallerCandidate = { ...computed, pipe };
      }
    }

    if (
      smallerCandidate
      && smallerCandidate.catalogPipeId !== defaultMatch.catalogPipeId
    ) {
      finalMatch = {
        edgeId: loopId,
        catalogPipeId: smallerCandidate.catalogPipeId,
        velocityMps: smallerCandidate.velocityMps,
        pressureDropKPa: smallerCandidate.pressureDropKPa,
        internalDiameterMm: smallerCandidate.internalDiameterMm,
      };
      pipeResizeAction = 'downsized';
      pipeResizeReason =
        `Низкая скорость ${defaultMatch.velocityMps} м/с — `
        + `рекомендован меньший Ø ${smallerCandidate.internalDiameterMm} мм.`;
    }
  } else if (vHigh || dpHigh) {
    /** @type {import('./ufhLoopHydraulics.types.js').UfhLoopPipeCandidate | null} */
    let best = null;
    for (const pipe of pool) {
      const computed = computeUfhLoopPipeHydraulics({
        pipe,
        loopLengthM,
        flowRateM3PerHour,
        localZeta,
        hydraulicsRules,
      });
      if (!computed) continue;

      const vOk =
        computed.velocityMps >= thresholds.velocityMinMps
        && computed.velocityMps <= thresholds.velocityMaxMps;
      const dpOk = computed.pressureDropKPa <= thresholds.maxPressureDropKPa;

      if (!vOk || !dpOk) continue;

      const candidate = { ...computed, pipe };

      if (
        !best
        || computed.internalDiameterMm > best.internalDiameterMm
        || (
          computed.internalDiameterMm === best.internalDiameterMm
          && computed.pressureDropKPa < (best.pressureDropKPa ?? Infinity)
        )
      ) {
        best = candidate;
      }
    }

    if (best && best.catalogPipeId !== defaultMatch.catalogPipeId) {
      finalMatch = {
        edgeId: loopId,
        catalogPipeId: best.catalogPipeId,
        velocityMps: best.velocityMps,
        pressureDropKPa: best.pressureDropKPa,
        internalDiameterMm: best.internalDiameterMm,
      };
      pipeResizeAction = 'upsized';
      if (vHigh) {
        pipeResizeReason =
          `Скорость ${defaultMatch.velocityMps} м/с выше порога ${thresholds.velocityMaxMps} м/с — `
          + `рекомендован Ø ${best.internalDiameterMm} мм.`;
      } else {
        pipeResizeReason =
          `Потери ${defaultMatch.pressureDropKPa} кПа близки к лимиту — `
          + `рекомендован Ø ${best.internalDiameterMm} мм.`;
      }
    }
  }

  return { finalMatch, pipeResizeAction, pipeResizeReason };
}

/**
 * @param {object} args
 * @param {string} args.loopId
 * @param {number} args.loopLengthM
 * @param {number} args.pipeSpacingMm
 * @param {number} args.heatLoadWatts
 * @param {number} args.deltaTK
 * @param {import('../catalog/types.js').NormalizedCatalog['pipes']} args.pipes
 * @param {import('../dhw/types.js').HydraulicsApplianceRulesDoc} args.hydraulicsRules
 * @param {import('../hydraulics/types.js').HydraulicsSurveyInput['pipeMaterialPreference']} [args.materialPreference]
 * @returns {import('./ufhLoopHydraulics.types.js').UfhLoopHydraulicsResult}
 */
export function validateUfhLoopHydraulics({
  loopId,
  loopLengthM,
  pipeSpacingMm,
  heatLoadWatts,
  deltaTK,
  pipes,
  hydraulicsRules,
  materialPreference,
}) {
  /** @type {string[]} */
  const warnings = [];
  const thresholds = ufhLoopHydraulicsThresholds(hydraulicsRules);
  const minNominalMm = ufhLoopMinNominalDiameterMm(hydraulicsRules);
  const flow = thermalLoadToFlow({ heatLoadWatts, deltaTK });
  const elbowCount = estimateUfhLoopElbowCount(loopLengthM, pipeSpacingMm);
  const localZeta = elbowCount * hydraulicsRules.localLossZeta.elbow90;

  /** @type {import('./ufhLoopHydraulics.types.js').UfhLoopHydraulicsResult} */
  const base = {
    loopId,
    loopLengthM: round(loopLengthM, 1),
    pipeSpacingMm,
    heatLoadWatts: round(heatLoadWatts, 0),
    deltaTK,
    flowRateM3PerHour: flow.flowRateM3PerHour,
    massFlowKgPerSec: flow.massFlowKgPerSec,
    elbowCount,
    localZeta: round(localZeta, 2),
    catalogPipeId: null,
    initialCatalogPipeId: null,
    internalDiameterMm: null,
    velocityMps: null,
    pressureDropKPa: null,
    pipeResizeAction: 'unchanged',
    pipeResizeReason: null,
    warnings,
  };

  if (loopLengthM <= 0 || heatLoadWatts <= 0) {
    warnings.push(`Петля ${loopId}: нулевая длина или нагрузка — гидравлика не рассчитана.`);
    return base;
  }

  const pool = filterUfhPipePool(pipes, minNominalMm, materialPreference);
  const pipesForPick = pool.length ? pool : pipes;

  if (!pipesForPick?.length) {
    warnings.push(`Петля ${loopId}: каталог труб пуст — подбор невозможен.`);
    return base;
  }

  /** @type {import('../hydraulics/types.js').HydraulicsRules} */
  const rulesForPick = {
    mainTransitMinInternalDiameterMm: hydraulicsRules.mainTransitMinInternalDiameterMm ?? 20,
    branchMinInternalDiameterMm: hydraulicsRules.branchMinInternalDiameterMm ?? 12,
    velocityLimitsMps: {
      ...hydraulicsRules.velocityLimitsMps,
      branchMax: thresholds.velocityMaxMps,
    },
    radiatorBranchGrouping: hydraulicsRules.radiatorBranchGrouping,
    defaultLengthsM: hydraulicsRules.defaultLengthsM,
    maxUfhLoopLengthM: hydraulicsRules.maxUfhLoopLengthM,
    roughnessMmByMaterial: hydraulicsRules.roughnessMmByMaterial,
    localLossZeta: hydraulicsRules.localLossZeta,
    pumpHeadMarginPercent: hydraulicsRules.pumpHeadMarginPercent,
    pumpDutyQMaxUtilizationPercent: hydraulicsRules.pumpDutyQMaxUtilizationPercent,
    pumpMinHeadAtDutyM: hydraulicsRules.pumpMinHeadAtDutyM,
    pumpMaxHeadMarginPercent: hydraulicsRules.pumpMaxHeadMarginPercent,
    pumpMinHeadAtQMaxM: hydraulicsRules.pumpMinHeadAtQMaxM,
    primaryFlowMarginPercent: hydraulicsRules.primaryFlowMarginPercent,
    balancingValveKPaPerTurn: hydraulicsRules.balancingValveKPaPerTurn,
  };

  const defaultMatch = pickPipeForEdge({
    edge: {
      id: loopId,
      from: 'ufh_collector',
      to: loopId,
      lengthM: loopLengthM,
      fluid: 'heating',
      designFlowM3PerHour: flow.flowRateM3PerHour,
      segmentRole: 'ufh_loop',
    },
    pipes: pipesForPick,
    rules: rulesForPick,
    materialPreference,
    localZeta,
  });

  if (!defaultMatch) {
    warnings.push(`Петля ${loopId}: не удалось подобрать трубу из каталога.`);
    return base;
  }

  base.initialCatalogPipeId = defaultMatch.catalogPipeId;

  const { finalMatch, pipeResizeAction, pipeResizeReason } = optimizeUfhLoopPipe({
    defaultMatch,
    pool: pool.length ? pool : pipesForPick,
    loopLengthM,
    flowRateM3PerHour: flow.flowRateM3PerHour,
    localZeta,
    hydraulicsRules,
    thresholds,
    loopId,
  });

  base.catalogPipeId = finalMatch.catalogPipeId;
  base.internalDiameterMm = finalMatch.internalDiameterMm;
  base.velocityMps = finalMatch.velocityMps;
  base.pressureDropKPa = finalMatch.pressureDropKPa;
  base.pipeResizeAction = pipeResizeAction;
  base.pipeResizeReason = pipeResizeReason;

  if (finalMatch.velocityMps < thresholds.velocityMinMps) {
    warnings.push(
      `Петля ${loopId}: низкая скорость ${finalMatch.velocityMps} м/с (< ${thresholds.velocityMinMps} м/с) — высокий риск завоздушивания контура.`,
    );
  }
  if (finalMatch.velocityMps > thresholds.velocityMaxMps) {
    warnings.push(
      `Петля ${loopId}: скорость ${finalMatch.velocityMps} м/с превышает шумовой порог ${thresholds.velocityMaxMps} м/с.`,
    );
  }
  if (finalMatch.pressureDropKPa > thresholds.maxPressureDropKPa) {
    warnings.push(
      `Петля ${loopId}: потери давления ${finalMatch.pressureDropKPa} кПа превышают допустимые ${thresholds.maxPressureDropKPa} кПа — уменьшите длину петли или увеличьте число контуров.`,
    );
  }
  if (pipeResizeReason) {
    warnings.push(`Петля ${loopId}: ${pipeResizeReason}`);
  }

  return base;
}

/**
 * @param {object} args
 * @param {number} args.loopsCount
 * @param {number} args.totalLengthM
 * @param {number} args.heatLoadWatts
 * @param {number} args.deltaTK
 * @param {string} args.roomId
 * @returns {import('../hydraulics/types.js').HydraulicsUfhLoop[]}
 */
function buildLoopsArray({
  loopsCount,
  totalLengthM,
  heatLoadWatts,
  deltaTK,
  roomId,
}) {
  const count = Math.max(1, loopsCount);
  const perLoopLength = totalLengthM / count;
  const perLoopHeat = heatLoadWatts / count;
  const perLoopFlow = thermalLoadToFlow({
    heatLoadWatts: perLoopHeat,
    deltaTK,
  });

  /** @type {import('../hydraulics/types.js').HydraulicsUfhLoop[]} */
  const loops = [];
  for (let i = 0; i < count; i += 1) {
    loops.push({
      loopId: `${roomId}_loop_${i + 1}`,
      loopLengthM: round(perLoopLength, 1),
      heatLoadWatts: round(perLoopHeat, 0),
      flowRateM3PerHour: perLoopFlow.flowRateM3PerHour,
    });
  }
  return loops;
}

/**
 * @param {import('./ufhLoopHydraulics.types.js').UfhLoopHydraulicsResult[]} loopHydraulics
 * @param {number} loopsCount
 * @param {number} minLoopsGeom
 */
function markLoopsCountAdjustment(loopHydraulics, loopsCount, minLoopsGeom) {
  if (loopsCount === minLoopsGeom) return;

  const reason =
    loopsCount < minLoopsGeom
      ? `Число петель снижено до ${loopsCount} (вместо ${minLoopsGeom}) для повышения скорости на петле.`
      : `Число петель увеличено до ${loopsCount} (вместо ${minLoopsGeom}) для снижения потерь давления.`;

  for (const h of loopHydraulics) {
    if (h.pipeResizeAction === 'unchanged') {
      h.pipeResizeAction = 'loops_adjusted';
      h.pipeResizeReason = reason;
      h.warnings.push(`Петля ${h.loopId}: ${reason}`);
    }
  }
}

/**
 * @param {object} args
 * @param {number} args.loopsCount
 * @param {number} args.totalLengthM
 * @param {number} args.pipeSpacingMm
 * @param {number} args.heatLoadWatts
 * @param {string} args.roomId
 * @param {import('../catalog/types.js').NormalizedCatalog['pipes']} args.pipes
 * @param {import('../dhw/types.js').HydraulicsApplianceRulesDoc} args.hydraulicsRules
 * @param {import('../hydraulics/types.js').HydraulicsSurveyInput['pipeMaterialPreference']} [args.materialPreference]
 * @param {{ velocityMinMps: number; velocityMaxMps: number; maxPressureDropKPa: number; deltaTK: number }} args.thresholds
 * @returns {{ loops: import('../hydraulics/types.js').HydraulicsUfhLoop[]; loopHydraulics: import('./ufhLoopHydraulics.types.js').UfhLoopHydraulicsResult[]; pressureOk: boolean; velocityOk: boolean }}
 */
function buildAndValidateLoopsConfiguration({
  loopsCount,
  totalLengthM,
  pipeSpacingMm,
  heatLoadWatts,
  roomId,
  pipes,
  hydraulicsRules,
  materialPreference,
  thresholds,
}) {
  const loops = buildLoopsArray({
    loopsCount,
    totalLengthM,
    heatLoadWatts,
    deltaTK: thresholds.deltaTK,
    roomId,
  });

  const loopHydraulics = loops.map((loop) =>
    validateUfhLoopHydraulics({
      loopId: loop.loopId,
      loopLengthM: loop.loopLengthM,
      pipeSpacingMm,
      heatLoadWatts: loop.heatLoadWatts,
      deltaTK: thresholds.deltaTK,
      pipes,
      hydraulicsRules,
      materialPreference,
    }),
  );

  return {
    loops,
    loopHydraulics,
    ...evaluateLoopsHydraulics(loopHydraulics, thresholds),
  };
}

/**
 * Подбор числа петель: геометрия + ограничения v и Δp на петлю.
 * @param {object} args
 * @param {number} args.areaM2
 * @param {number} args.pipeSpacingMm
 * @param {number} args.heatLoadWatts
 * @param {number} [args.heatFluxDownWm2]
 * @param {number} [args.heatFluxDownWatts]
 * @param {number} [args.heatFluxUpWatts]
 * @param {string} [args.bottomBoundary]
 * @param {string} args.roomId
 * @param {import('../catalog/types.js').NormalizedCatalog['pipes']} args.pipes
 * @param {import('../dhw/types.js').HydraulicsApplianceRulesDoc} args.hydraulicsRules
 * @param {import('../hydraulics/types.js').HydraulicsSurveyInput['pipeMaterialPreference']} [args.materialPreference]
 * @returns {import('./ufhLoopHydraulics.types.js').UfhRoomLoopsHydraulicsResult}
 */
export function resolveUfhRoomLoopsHydraulics({
  areaM2,
  pipeSpacingMm,
  heatLoadWatts,
  heatFluxDownWm2: _heatFluxDownWm2 = 0,
  heatFluxDownWatts: _heatFluxDownWatts = 0,
  heatFluxUpWatts: _heatFluxUpWatts = 0,
  bottomBoundary: _bottomBoundary,
  roomId,
  pipes,
  hydraulicsRules,
  materialPreference,
}) {
  /** @type {string[]} */
  const warnings = [];
  const thresholds = ufhLoopHydraulicsThresholds(hydraulicsRules);
  const layoutFactor =
    typeof hydraulicsRules.ufhLoopLengthLayoutFactor === 'number' &&
    Number.isFinite(hydraulicsRules.ufhLoopLengthLayoutFactor)
      ? hydraulicsRules.ufhLoopLengthLayoutFactor
      : UFH_LOOP_LENGTH_LAYOUT_FACTOR_DEFAULT;
  const totalLengthM = computeUfhLoopTotalLengthM({
    areaM2,
    pipeSpacingMm,
    layoutFactor,
  });
  const maxLen = Math.max(20, hydraulicsRules.maxUfhLoopLengthM);
  const minLoopsGeom = Math.max(1, Math.ceil(totalLengthM / maxLen));

  /** @type {{ loopsCount: number; loops: import('../hydraulics/types.js').HydraulicsUfhLoop[]; loopHydraulics: import('./ufhLoopHydraulics.types.js').UfhLoopHydraulicsResult[]; distance: number } | null} */
  let bestResolved = null;
  /** @type {{ loopsCount: number; loops: import('../hydraulics/types.js').HydraulicsUfhLoop[]; loopHydraulics: import('./ufhLoopHydraulics.types.js').UfhLoopHydraulicsResult[]; score: number; distance: number } | null} */
  let bestPartial = null;

  for (let loopsCount = 1; loopsCount <= MAX_LOOPS_HEURISTIC; loopsCount += 1) {
    const perLoopLength = totalLengthM / loopsCount;
    if (perLoopLength > maxLen + 0.01) continue;

    const cfg = buildAndValidateLoopsConfiguration({
      loopsCount,
      totalLengthM,
      pipeSpacingMm,
      heatLoadWatts,
      roomId,
      pipes,
      hydraulicsRules,
      materialPreference,
      thresholds,
    });

    const distance = Math.abs(loopsCount - minLoopsGeom);

    if (cfg.pressureOk && cfg.velocityOk) {
      if (!bestResolved || distance < bestResolved.distance) {
        bestResolved = {
          loopsCount,
          loops: cfg.loops,
          loopHydraulics: cfg.loopHydraulics,
          distance,
        };
      }
      continue;
    }

    const score = scorePartialLoopsConfiguration(cfg.loopHydraulics, thresholds);
    if (!bestPartial || score < bestPartial.score || (score === bestPartial.score && distance < bestPartial.distance)) {
      bestPartial = {
        loopsCount,
        loops: cfg.loops,
        loopHydraulics: cfg.loopHydraulics,
        score,
        distance,
      };
    }
  }

  const outcome = (() => {
    if (bestResolved) {
      const { loops, loopHydraulics, loopsCount: chosenLoopsCount } = bestResolved;
      markLoopsCountAdjustment(loopHydraulics, chosenLoopsCount, minLoopsGeom);
      return {
        loops,
        loopHydraulics,
        chosenLoopsCount,
        resolutionStatus: 'resolved_auto',
        appliedFix: deriveAppliedFix({
          loopsCount: chosenLoopsCount,
          minLoopsGeom,
          loopHydraulics,
        }),
        pipeResizeApplied: loopHydraulics.some(
          (h) => h.pipeResizeAction !== 'unchanged',
        ),
        extraWarnings: [],
      };
    }

    if (bestPartial) {
      const { loops, loopHydraulics, loopsCount: chosenLoopsCount } = bestPartial;
      const resolutionStatus = deriveResolutionStatus(loopHydraulics, thresholds);
      markLoopsCountAdjustment(loopHydraulics, chosenLoopsCount, minLoopsGeom);
      /** @type {string[]} */
      const extraWarnings = [];
      if (resolutionStatus === 'unresolved_pressure') {
        extraWarnings.push(
          `Комната ${roomId}: не удалось уложиться в ${thresholds.maxPressureDropKPa} кПа на петлю при допустимом числе контуров — требуется проектная проработка.`,
        );
      }
      return {
        loops,
        loopHydraulics,
        chosenLoopsCount,
        resolutionStatus,
        appliedFix: deriveAppliedFix({
          loopsCount: chosenLoopsCount,
          minLoopsGeom,
          loopHydraulics,
        }),
        pipeResizeApplied: loopHydraulics.some(
          (h) => h.pipeResizeAction !== 'unchanged',
        ),
        extraWarnings,
      };
    }

    const fallback = buildAndValidateLoopsConfiguration({
      loopsCount: minLoopsGeom,
      totalLengthM,
      pipeSpacingMm,
      heatLoadWatts,
      roomId,
      pipes,
      hydraulicsRules,
      materialPreference,
      thresholds,
    });
    return {
      loops: fallback.loops,
      loopHydraulics: fallback.loopHydraulics,
      chosenLoopsCount: minLoopsGeom,
      resolutionStatus: deriveResolutionStatus(fallback.loopHydraulics, thresholds),
      appliedFix: deriveAppliedFix({
        loopsCount: minLoopsGeom,
        minLoopsGeom,
        loopHydraulics: fallback.loopHydraulics,
      }),
      pipeResizeApplied: false,
      extraWarnings: [
        `Комната ${roomId}: не удалось подобрать конфигурацию петель — требуется проектная проработка.`,
      ],
    };
  })();

  warnings.push(...outcome.extraWarnings);
  for (const h of outcome.loopHydraulics) {
    warnings.push(...h.warnings);
  }

  return {
    loopsCount: outcome.loops.length,
    loops: outcome.loops,
    loopHydraulics: outcome.loopHydraulics,
    warnings,
    pipeResizeApplied: outcome.pipeResizeApplied,
    resolutionStatus:
      /** @type {import('./ufhLoopHydraulics.types.js').UfhLoopResolutionStatus} */ (
        outcome.resolutionStatus
      ),
    appliedFix: outcome.appliedFix,
    minLoopsGeom,
    chosenLoopsCount: outcome.chosenLoopsCount,
  };
}

/**
 * Структурированные REC/WARN по гидравлике петель ТП.
 * @param {import('../types/shared-types.js').UnderfloorHeatingReport} underfloorHeating
 * @param {import('../recommendations/types.js').RecommendationsBundle} recommendations
 * @param {import('../dhw/types.js').HydraulicsApplianceRulesDoc | undefined} [hydraulicsRules]
 */
export function applyUfhLoopHydraulicsRecommendations(
  underfloorHeating,
  recommendations,
  hydraulicsRules,
) {
  if (!underfloorHeating?.rooms?.length || !hydraulicsRules) return;

  const thresholds = ufhLoopHydraulicsThresholds(hydraulicsRules);

  /** @type {string[]} */
  const warnings = [];
  /** @type {import('../recommendations/types.js').ResolvedRecommendation[]} */
  const resolvedRecommendations = [];

  for (const room of underfloorHeating.rooms) {
    const status = room.loopHydraulicsResolutionStatus;
    if (!status) continue;

    const vars = {
      roomName: room.roomName,
      loopsCount: room.loopsCount ?? 0,
      minLoopsGeom: room.loopHydraulicsMinLoopsGeom ?? room.loopsCount ?? 0,
      velocityMinMps: thresholds.velocityMinMps,
      maxPressureDropKPa: thresholds.maxPressureDropKPa,
    };

    if (
      status === 'resolved_auto'
      && room.loopHydraulicsAppliedFix
      && room.loopHydraulicsAppliedFix !== 'none'
    ) {
      pushRecommendation(
        warnings,
        resolvedRecommendations,
        recommendations,
        'REC_UFH_LOOP_VELOCITY_AUTO_FIXED',
        {
          ...vars,
          appliedFix: room.loopHydraulicsAppliedFix,
        },
      );
      continue;
    }

    if (status === 'unresolved_velocity') {
      pushRecommendation(
        warnings,
        resolvedRecommendations,
        recommendations,
        'WARN_UFH_LOOP_LOW_VELOCITY_UNRESOLVED',
        vars,
      );
    } else if (status === 'unresolved_pressure') {
      pushRecommendation(
        warnings,
        resolvedRecommendations,
        recommendations,
        'WARN_UFH_LOOP_HIGH_PRESSURE',
        vars,
      );
    } else if (status === 'unresolved_conflict') {
      pushRecommendation(
        warnings,
        resolvedRecommendations,
        recommendations,
        'WARN_UFH_LOOP_VELOCITY_PRESSURE_CONFLICT',
        vars,
      );
    }
  }

  if (warnings.length > 0) {
    underfloorHeating.warnings = [...(underfloorHeating.warnings ?? []), ...warnings];
  }
  if (resolvedRecommendations.length > 0) {
    underfloorHeating.resolvedRecommendations = [
      ...(underfloorHeating.resolvedRecommendations ?? []),
      ...resolvedRecommendations,
    ];
  }
}

/**
 * Обогащает отчёт ТП гидравликой петель (после warmFloorCalc, когда доступен каталог).
 * @param {import('../types/shared-types.js').UnderfloorHeatingReport} underfloorHeating
 * @param {object} ctx
 * @param {import('../catalog/types.js').NormalizedCatalog} ctx.catalog
 * @param {import('../dhw/types.js').HydraulicsApplianceRulesDoc} ctx.hydraulicsRules
 * @param {import('../hydraulics/types.js').HydraulicsSurveyInput['pipeMaterialPreference']} [ctx.materialPreference]
 */
export function enrichUnderfloorHeatingLoopHydraulics(
  underfloorHeating,
  { catalog, hydraulicsRules, materialPreference },
) {
  if (!underfloorHeating?.rooms?.length) return;

  const pipes = catalog.pipes ?? [];

  for (const room of underfloorHeating.rooms) {
    const resolved = resolveUfhRoomLoopsHydraulics({
      areaM2: room.heatedAreaM2 ?? room.areaM2,
      pipeSpacingMm: room.pipeSpacingMm,
      heatLoadWatts: room.heatLoadWatts ?? room.heatFluxUpWatts,
      heatFluxDownWm2: room.heatFluxDownWm2,
      heatFluxDownWatts: room.heatFluxDownWatts,
      heatFluxUpWatts: room.heatFluxUpWatts,
      bottomBoundary: room.bottomBoundary,
      roomId: room.roomId,
      pipes,
      hydraulicsRules,
      materialPreference,
    });

    room.loopsCount = resolved.loopsCount;
    room.loops = resolved.loops.map((loop, idx) => ({
      ...loop,
      catalogPipeId: resolved.loopHydraulics[idx]?.catalogPipeId ?? undefined,
      hydraulics: resolved.loopHydraulics[idx],
    }));
    room.flowRateM3PerHour = round(
      resolved.loops.reduce((s, l) => s + l.flowRateM3PerHour, 0),
      3,
    );
    room.loopHydraulicsResolutionStatus = resolved.resolutionStatus;
    room.loopHydraulicsAppliedFix = resolved.appliedFix;
    room.loopHydraulicsMinLoopsGeom = resolved.minLoopsGeom;

    if (resolved.pipeResizeApplied) {
      room.pipeResizeApplied = true;
    }

    const prefixed = resolved.warnings.map(
      (w) => `Комната «${room.roomName}»: ${w}`,
    );
    room.warnings = [...(room.warnings ?? []), ...prefixed];
    underfloorHeating.warnings = [...(underfloorHeating.warnings ?? []), ...prefixed];
  }
}
