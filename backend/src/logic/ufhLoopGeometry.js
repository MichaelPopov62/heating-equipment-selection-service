/**
 * Назначение: геометрия петель ТП (количество и длина).
 * Описание: Вызывается из warmFloorCalc; гидравлика только читает loops[].
 */

import { thermalLoadToFlow } from '../hydraulics/thermalLoadToFlow.js';
import { round } from '../utils/math.js';

/**
 * @param {object} args
 * @param {number} args.areaM2
 * @param {number} args.pipeSpacingMm
 * @param {number} args.heatLoadWatts
 * @param {number} args.deltaTK
 * @param {number} args.maxLoopLengthM
 * @param {string} args.roomId
 * @returns {{ loopsCount: number; loops: import('../hydraulics/types').HydraulicsUfhLoop[]; flowRateM3PerHour: number }}
 */
export function computeUfhLoopGeometry({
  areaM2,
  pipeSpacingMm,
  heatLoadWatts,
  deltaTK,
  maxLoopLengthM,
  roomId,
}) {
  const area = Math.max(0, Number(areaM2) || 0);
  const spacingM = Math.max(0.05, (Number(pipeSpacingMm) || 150) / 1000);
  const maxLen = Math.max(20, Number(maxLoopLengthM) || 100);

  const estimatedTotalLengthM = area > 0 ? area / spacingM : 0;
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

  /** @type {import('../hydraulics/types').HydraulicsUfhLoop[]} */
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
  };
}
