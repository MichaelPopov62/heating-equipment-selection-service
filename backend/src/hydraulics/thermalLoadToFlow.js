/**
 * Назначение: SSOT — расход теплоносителя по тепловой нагрузке и Δt.
 * Описание: G = Q / (c·Δt); Vdot = G/ρ·3600. Используется upstream-модулями и pipeline.
 */

import { round } from '../utils/math.js';

const C_J_PER_KG_K = 4180;
const RHO_KG_PER_M3 = 1000;

/**
 * @param {object} args
 * @param {number} args.heatLoadWatts
 * @param {number} args.deltaTK — перепад температур контура, K
 * @returns {{ deltaTK: number, massFlowKgPerSec: number, flowRateM3PerHour: number }}
 */
export function thermalLoadToFlow({ heatLoadWatts, deltaTK } = {}) {
  const Q = Number(heatLoadWatts) || 0;
  const dt = Number(deltaTK) || 0;

  const massFlowKgPerSec =
    Q > 0 && dt > 0 ? Q / (C_J_PER_KG_K * dt) : 0;
  const flowRateM3PerHour = (massFlowKgPerSec / RHO_KG_PER_M3) * 3600;

  return {
    deltaTK: dt,
    massFlowKgPerSec: round(massFlowKgPerSec, 4),
    flowRateM3PerHour: round(flowRateM3PerHour, 3),
  };
}

export { C_J_PER_KG_K, RHO_KG_PER_M3 };
