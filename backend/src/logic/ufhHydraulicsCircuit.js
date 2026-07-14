/**
 * Назначение: гидравлика контура ТП (отдельный Δt = 10 K).
 * Описание: Расход теплоносителя по суммарной мощности ТП вверх (SSOT thermalLoadToFlow).
 */

import { thermalLoadToFlow } from '../hydraulics/thermalLoadToFlow.js';

/**
 * @param {{ heatLoadWatts?: number; deltaTK?: number }} [args]
 * @returns {{ deltaTK: number; massFlowKgPerSec: number; flowRateM3PerHour: number }}
 */
export function computeUnderfloorHydraulicsCircuit({
  heatLoadWatts = 0,
  deltaTK = 10,
} = {}) {
  const dt = Number(deltaTK) || 10;
  const flow = thermalLoadToFlow({ heatLoadWatts, deltaTK: dt });
  return {
    deltaTK: dt,
    massFlowKgPerSec: flow.massFlowKgPerSec,
    flowRateM3PerHour: flow.flowRateM3PerHour,
  };
}
