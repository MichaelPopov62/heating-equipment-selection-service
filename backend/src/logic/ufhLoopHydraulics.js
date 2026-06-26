/**
 * Назначение: гидравлическая проверка петель ТП (СП 60.13330 / ГОСТ Р 70834-2023, MVP).
 * Описание: Расход по Q/(c·Δt), подбор трубы из каталога, v и Δp (Darcy + повороты 90°).
 */

import { pickPipeForEdge } from '../hydraulics/pickPipe.js';
import { thermalLoadToFlow } from '../hydraulics/thermalLoadToFlow.js';
import { round } from '../utils/math.js';

const MAX_LOOPS_HEURISTIC = 32;

/**
 * Оценка числа поворотов 90° в «змейке» петли ТП.
 * L ≈ A/s, рядов ~√(L·s)/s → поворотов ~2·√(L/s).
 * @param {number} lengthM
 * @param {number} pipeSpacingMm
 * @returns {number}
 */
export function estimateUfhLoopElbowCount(lengthM, pipeSpacingMm) {
  const spacingM = Math.max(0.05, (Number(pipeSpacingMm) || 150) / 1000);
  const len = Math.max(0, Number(lengthM) || 0);
  if (len <= 0) return 0;
  const ratio = len / spacingM;
  if (ratio <= 0) return 2;
  return Math.max(2, Math.round(2 * Math.sqrt(ratio)));
}

/**
 * @param {import('../dhw/types').HydraulicsApplianceRulesDoc} rules
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
 * @param {object} args
 * @param {string} args.loopId
 * @param {number} args.lengthM
 * @param {number} args.pipeSpacingMm
 * @param {number} args.heatLoadWatts
 * @param {number} args.deltaTK
 * @param {import('../catalog/types').NormalizedCatalog['pipes']} args.pipes
 * @param {import('../dhw/types').HydraulicsApplianceRulesDoc} args.hydraulicsRules
 * @param {import('../hydraulics/types').HydraulicsSurveyInput['pipeMaterialPreference']} [args.materialPreference]
 * @returns {import('./ufhLoopHydraulics.types').UfhLoopHydraulicsResult}
 */
export function validateUfhLoopHydraulics({
  loopId,
  lengthM,
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
  const flow = thermalLoadToFlow({ heatLoadWatts, deltaTK });
  const elbowCount = estimateUfhLoopElbowCount(lengthM, pipeSpacingMm);
  const localZeta = elbowCount * hydraulicsRules.localLossZeta.elbow90;

  /** @type {import('./ufhLoopHydraulics.types').UfhLoopHydraulicsResult} */
  const base = {
    loopId,
    lengthM: round(lengthM, 1),
    pipeSpacingMm,
    heatLoadWatts: round(heatLoadWatts, 0),
    deltaTK,
    flowRateM3PerHour: flow.flowRateM3PerHour,
    massFlowKgPerSec: flow.massFlowKgPerSec,
    elbowCount,
    localZeta: round(localZeta, 2),
    catalogPipeId: null,
    internalDiameterMm: null,
    velocityMps: null,
    pressureDropKPa: null,
    warnings,
  };

  if (lengthM <= 0 || heatLoadWatts <= 0) {
    warnings.push(`Петля ${loopId}: нулевая длина или нагрузка — гидравлика не рассчитана.`);
    return base;
  }

  if (!pipes?.length) {
    warnings.push(`Петля ${loopId}: каталог труб пуст — подбор невозможен.`);
    return base;
  }

  const rulesForPick = {
    velocityLimitsMps: {
      ...hydraulicsRules.velocityLimitsMps,
      branchMax: thresholds.velocityMaxMps,
    },
    roughnessMmByMaterial: hydraulicsRules.roughnessMmByMaterial,
    localLossZeta: hydraulicsRules.localLossZeta,
    defaultLengthsM: hydraulicsRules.defaultLengthsM,
    maxUfhLoopLengthM: hydraulicsRules.maxUfhLoopLengthM,
    pumpHeadMarginPercent: hydraulicsRules.pumpHeadMarginPercent,
  };

  const match = pickPipeForEdge({
    edge: {
      id: loopId,
      from: 'ufh_collector',
      to: loopId,
      lengthM,
      fluid: 'heating',
      designFlowM3PerHour: flow.flowRateM3PerHour,
      segmentRole: 'ufh_loop',
    },
    pipes,
    rules: rulesForPick,
    materialPreference,
    localZeta,
  });

  if (!match) {
    warnings.push(`Петля ${loopId}: не удалось подобрать трубу из каталога.`);
    return base;
  }

  base.catalogPipeId = match.catalogPipeId;
  base.internalDiameterMm = match.internalDiameterMm;
  base.velocityMps = match.velocityMps;
  base.pressureDropKPa = match.pressureDropKPa;

  if (match.velocityMps < thresholds.velocityMinMps) {
    warnings.push(
      `Петля ${loopId}: низкая скорость ${match.velocityMps} м/с (< ${thresholds.velocityMinMps} м/с) — высокий риск завоздушивания контура.`,
    );
  }
  if (match.velocityMps > thresholds.velocityMaxMps) {
    warnings.push(
      `Петля ${loopId}: скорость ${match.velocityMps} м/с превышает шумовой порог ${thresholds.velocityMaxMps} м/с.`,
    );
  }
  if (match.pressureDropKPa > thresholds.maxPressureDropKPa) {
    warnings.push(
      `Петля ${loopId}: потери давления ${match.pressureDropKPa} кПа превышают допустимые ${thresholds.maxPressureDropKPa} кПа — уменьшите длину петли или увеличьте число контуров.`,
    );
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
 * @returns {import('../hydraulics/types').HydraulicsUfhLoop[]}
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

  /** @type {import('../hydraulics/types').HydraulicsUfhLoop[]} */
  const loops = [];
  for (let i = 0; i < count; i += 1) {
    loops.push({
      loopId: `${roomId}_loop_${i + 1}`,
      estimatedLengthM: round(perLoopLength, 1),
      heatLoadWatts: round(perLoopHeat, 0),
      flowRateM3PerHour: perLoopFlow.flowRateM3PerHour,
    });
  }
  return loops;
}

/**
 * Подбор числа петель: геометрия + ограничение Δp ≤ maxUfhLoopPressureDropKPa.
 * @param {object} args
 * @param {number} args.areaM2
 * @param {number} args.pipeSpacingMm
 * @param {number} args.heatLoadWatts
 * @param {string} args.roomId
 * @param {import('../catalog/types').NormalizedCatalog['pipes']} args.pipes
 * @param {import('../dhw/types').HydraulicsApplianceRulesDoc} args.hydraulicsRules
 * @param {import('../hydraulics/types').HydraulicsSurveyInput['pipeMaterialPreference']} [args.materialPreference]
 * @returns {{ loopsCount: number; loops: import('../hydraulics/types').HydraulicsUfhLoop[]; loopHydraulics: import('./ufhLoopHydraulics.types').UfhLoopHydraulicsResult[]; warnings: string[] }}
 */
export function resolveUfhRoomLoopsHydraulics({
  areaM2,
  pipeSpacingMm,
  heatLoadWatts,
  roomId,
  pipes,
  hydraulicsRules,
  materialPreference,
}) {
  /** @type {string[]} */
  const warnings = [];
  const thresholds = ufhLoopHydraulicsThresholds(hydraulicsRules);
  const spacingM = Math.max(0.05, (Number(pipeSpacingMm) || 150) / 1000);
  const totalLengthM = areaM2 > 0 ? areaM2 / spacingM : 0;
  const maxLen = Math.max(20, hydraulicsRules.maxUfhLoopLengthM);

  let loopsCount = Math.max(1, Math.ceil(totalLengthM / maxLen));
  let resolved = false;

  /** @type {import('../hydraulics/types').HydraulicsUfhLoop[]} */
  let loops = [];
  /** @type {import('./ufhLoopHydraulics.types').UfhLoopHydraulicsResult[]} */
  let loopHydraulics = [];

  for (; loopsCount <= MAX_LOOPS_HEURISTIC; loopsCount += 1) {
    loops = buildLoopsArray({
      loopsCount,
      totalLengthM,
      heatLoadWatts,
      deltaTK: thresholds.deltaTK,
      roomId,
    });

    loopHydraulics = loops.map((loop) =>
      validateUfhLoopHydraulics({
        loopId: loop.loopId,
        lengthM: loop.estimatedLengthM,
        pipeSpacingMm,
        heatLoadWatts: loop.heatLoadWatts,
        deltaTK: thresholds.deltaTK,
        pipes,
        hydraulicsRules,
        materialPreference,
      }),
    );

    const pressureOk = loopHydraulics.every(
      (h) =>
        h.pressureDropKPa == null
        || h.pressureDropKPa <= thresholds.maxPressureDropKPa,
    );

    if (pressureOk) {
      resolved = true;
      break;
    }
  }

  if (!resolved) {
    warnings.push(
      `Комната ${roomId}: не удалось уложиться в ${thresholds.maxPressureDropKPa} кПа на петлю за ${MAX_LOOPS_HEURISTIC} контуров — требуется проектная проработка.`,
    );
  }

  for (const h of loopHydraulics) {
    warnings.push(...h.warnings);
  }

  return {
    loopsCount: loops.length,
    loops,
    loopHydraulics,
    warnings,
  };
}

/**
 * Обогащает отчёт ТП гидравликой петель (после warmFloorCalc, когда доступен каталог).
 * @param {import('../types/shared-types').UnderfloorHeatingReport} underfloorHeating
 * @param {object} ctx
 * @param {import('../catalog/types').NormalizedCatalog} ctx.catalog
 * @param {import('../dhw/types').HydraulicsApplianceRulesDoc} ctx.hydraulicsRules
 * @param {import('../hydraulics/types').HydraulicsSurveyInput['pipeMaterialPreference']} [ctx.materialPreference]
 */
export function enrichUnderfloorHeatingLoopHydraulics(
  underfloorHeating,
  { catalog, hydraulicsRules, materialPreference },
) {
  if (!underfloorHeating?.rooms?.length) return;

  const pipes = catalog.pipes ?? [];

  for (const room of underfloorHeating.rooms) {
    const resolved = resolveUfhRoomLoopsHydraulics({
      areaM2: room.areaM2,
      pipeSpacingMm: room.pipeSpacingMm,
      heatLoadWatts: room.heatLoadWatts ?? room.heatFluxUpWatts,
      roomId: room.roomId,
      pipes,
      hydraulicsRules,
      materialPreference,
    });

    room.loopsCount = resolved.loopsCount;
    room.loops = resolved.loops.map((loop, idx) => ({
      ...loop,
      hydraulics: resolved.loopHydraulics[idx],
    }));
    room.flowRateM3PerHour = round(
      resolved.loops.reduce((s, l) => s + l.flowRateM3PerHour, 0),
      3,
    );

    const prefixed = resolved.warnings.map(
      (w) => `Комната «${room.roomName}»: ${w}`,
    );
    room.warnings = [...(room.warnings ?? []), ...prefixed];
    underfloorHeating.warnings = [...(underfloorHeating.warnings ?? []), ...prefixed];
  }
}
