/**
 * Назначение: геометрия петель ТП (количество и длина).
 * Описание: Вызывается из warmFloorCalc; гидравлика только читает loops[].
 * Длина: L = S/a × layoutFactor (SSOT — ufhLoopLength.js).
 */

import { thermalLoadToFlow } from '../hydraulics/thermalLoadToFlow.js';
import { round } from '../utils/math.js';
import {
  UFH_LOOP_LENGTH_LAYOUT_FACTOR_DEFAULT,
  computeUfhLoopTotalLengthM,
  ufhPipeMetersPerSqM,
} from './ufhLoopLength.js';

/**
 * @param {object} args
 * @param {number} args.areaM2
 * @param {number} args.pipeSpacingMm
 * @param {number} args.heatLoadWatts
 * @param {number} args.deltaTK
 * @param {number} args.maxLoopLengthM
 * @param {number} [args.layoutFactor]
 * @param {string} args.roomId
 * @returns {{
 *   loopsCount: number;
 *   loops: import('../hydraulics/types.js').HydraulicsUfhLoop[];
 *   flowRateM3PerHour: number;
 *   totalLengthM: number;
 *   pipeMetersPerSqM: number;
 *   layoutFactor: number;
 * }}
 */
export function computeUfhLoopGeometry({
  areaM2,
  pipeSpacingMm,
  heatLoadWatts,
  deltaTK,
  maxLoopLengthM,
  layoutFactor = UFH_LOOP_LENGTH_LAYOUT_FACTOR_DEFAULT,
  roomId,
}) {
  const area = Math.max(0, Number(areaM2) || 0);
  const maxLen = Math.max(20, Number(maxLoopLengthM) || 80);
  const factor = Number(layoutFactor);
  const resolvedFactor =
    Number.isFinite(factor) && factor >= 1
      ? factor
      : UFH_LOOP_LENGTH_LAYOUT_FACTOR_DEFAULT;

  const estimatedTotalLengthM = computeUfhLoopTotalLengthM({
    areaM2: area,
    pipeSpacingMm,
    layoutFactor: resolvedFactor,
  });
  const metersPerSqM = area > 0 ? ufhPipeMetersPerSqM(pipeSpacingMm, resolvedFactor) : 0;

  let loopsCount = 1;
  if (estimatedTotalLengthM > maxLen) {
    loopsCount = Math.ceil(estimatedTotalLengthM / maxLen);
  }

  const perLoopLength = loopsCount > 0 ? estimatedTotalLengthM / loopsCount : 0;
  const perLoopHeat = heatLoadWatts / Math.max(loopsCount, 1);
  const roomFlow = thermalLoadToFlow({ heatLoadWatts, deltaTK });
  const perLoopFlow = thermalLoadToFlow({
    heatLoadWatts: perLoopHeat,
    deltaTK,
  });

  /** @type {import('../hydraulics/types.js').HydraulicsUfhLoop[]} */
  const loops = [];
  for (let i = 0; i < loopsCount; i += 1) {
    loops.push({
      loopId: `${roomId}_loop_${i + 1}`,
      loopLengthM: round(perLoopLength, 1),
      heatLoadWatts: round(perLoopHeat, 0),
      flowRateM3PerHour: perLoopFlow.flowRateM3PerHour,
    });
  }

  return {
    loopsCount,
    loops,
    flowRateM3PerHour: roomFlow.flowRateM3PerHour,
    totalLengthM: round(estimatedTotalLengthM, 1),
    pipeMetersPerSqM: round(metersPerSqM, 3),
    layoutFactor: resolvedFactor,
  };
}
