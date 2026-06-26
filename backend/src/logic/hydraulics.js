/**
 * Назначение: legacy-обёртка MVP-гидравлики.
 * @deprecated Используйте hydraulics/public.js → runHydraulicsPipeline.
 * Описание: Сохранена для обратной совместимости импортов; делегирует thermalLoadToFlow.
 */

import { thermalLoadToFlow } from '../hydraulics/thermalLoadToFlow.js';
import { coarseRecommendedDn } from '../hydraulics/pressureDrop.js';

/**
 * @param {object} args
 * @param {number} args.heatLoadWatts
 * @param {number} [args.deltaTSystemK]
 * @param {number} [args.mainLineLengthM]
 * @param {number} [args.flowRateM3PerHour] — явный расход (м³/ч)
 * @returns {import('../types/shared-types').HydraulicsReport}
 */
export function calculateHydraulics({
  heatLoadWatts,
  deltaTSystemK = 20,
  mainLineLengthM = 0,
  flowRateM3PerHour: flowOverride,
} = {}) {
  const Q = Number(heatLoadWatts) || 0;
  const dt = Number(deltaTSystemK) || 20;

  let massFlowKgPerSec;
  let volumeFlowM3PerHour;

  if (
    typeof flowOverride === 'number'
    && Number.isFinite(flowOverride)
    && flowOverride >= 0
  ) {
    volumeFlowM3PerHour = flowOverride;
    massFlowKgPerSec = (volumeFlowM3PerHour * 1000) / 3600;
  } else {
    const flow = thermalLoadToFlow({ heatLoadWatts: Q, deltaTK: dt });
    massFlowKgPerSec = flow.massFlowKgPerSec;
    volumeFlowM3PerHour = flow.flowRateM3PerHour;
  }

  const notes = [];
  if (mainLineLengthM > 40) {
    notes.push(
      'Длинная магистраль: на реальном проекте обязательно считать сопротивления и насос.',
    );
  }

  return {
    schemaVersion: 1,
    inputs: {
      heatLoadWatts: Q,
      deltaTSystemK: dt,
      mainLineLengthM: Number(mainLineLengthM) || 0,
    },
    massFlowKgPerSec,
    flowRateM3PerHour: volumeFlowM3PerHour,
    recommendedPipeDiameter: coarseRecommendedDn(volumeFlowM3PerHour),
    recommendedVelocityRangeMPerSec: [0.2, 0.8],
    notes,
  };
}
