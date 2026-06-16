/**
 * Назначение: гидравлика контура ТП (отдельный Δt = 10 K).
 * Описание: Расход теплоносителя по суммарной мощности ТП вверх.
 */

import { round } from '../utils/math.js';

const C_J_PER_KG_K = 4180;
const RHO_KG_PER_M3 = 1000;

/**
 * @param {object} args
 * @param {number} args.heatLoadWatts — totalHeatFluxUpWatts
 * @param {number} [args.deltaTK=10]
 * @returns {{ deltaTK: number, massFlowKgPerSec: number, flowRateM3PerHour: number }}
 */
export function computeUnderfloorHydraulicsCircuit({
  heatLoadWatts,
  deltaTK = 10,
} = {}) {
  const Q = Number(heatLoadWatts) || 0;
  const dt = Number(deltaTK) || 10;

  const massFlowKgPerSec = Q > 0 && dt > 0 ? Q / (C_J_PER_KG_K * dt) : 0;
  const flowRateM3PerHour = (massFlowKgPerSec / RHO_KG_PER_M3) * 3600;

  return {
    deltaTK: dt,
    massFlowKgPerSec: round(massFlowKgPerSec, 4),
    flowRateM3PerHour: round(flowRateM3PerHour, 3),
  };
}
