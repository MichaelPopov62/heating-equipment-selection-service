/**
 * Назначение: упрощённый расчёт гидравлики (MVP).
 * Описание: Оценивает массовый и объёмный расход теплоносителя по тепловой нагрузке и Δt системы; даёт ориентиры по диаметру магистрали и скорости. Экспортирует calculateHydraulics(); результат включается в report.calculations.hydraulics.
 */

import { round } from '../utils/math.js';

/**
 * Упрощённая гидравлика (MVP).
 *
 * 1) Оценка массового расхода теплоносителя:
 *    G(кг/с) = Q(Вт) / (c * Δt), где c≈4180 Дж/(кг·K)
 * 2) Объёмный расход:
 *    Vdot(м³/ч) = G / ρ * 3600, где ρ≈1000 кг/м³
 * 3) Рекомендации по скорости: 0.2–0.8 м/с (магистрали), выше — шум/потери.
 *
 * Здесь мы не считаем сопротивления/подбор насоса — только ориентиры.
 */
/**
 * @param {object} args
 * @param {number} args.heatLoadWatts
 * @param {number} [args.deltaTSystemK]
 * @param {number} [args.mainLineLengthM]
 * @param {number} [args.flowRateM3PerHour] — явный расход (м³/ч), напр. из underfloorHydraulics; приоритет над Q/Δt
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

  const c = 4180;
  const rho = 1000;

  /** @type {number} */
  let massFlowKgPerSec;
  /** @type {number} */
  let volumeFlowM3PerHour;

  if (
    typeof flowOverride === 'number'
    && Number.isFinite(flowOverride)
    && flowOverride >= 0
  ) {
    volumeFlowM3PerHour = flowOverride;
    massFlowKgPerSec = (volumeFlowM3PerHour * rho) / 3600;
  } else {
    massFlowKgPerSec = Q > 0 ? Q / (c * dt) : 0;
    volumeFlowM3PerHour = (massFlowKgPerSec / rho) * 3600;
  }

  // Очень грубая рекомендация «условного диаметра» по расходу.
  // (Без учёта материала труб и допустимых скоростей)
  let recommended = 'DN15–DN20';
  if (volumeFlowM3PerHour > 1.5) recommended = 'DN25–DN32';
  else if (volumeFlowM3PerHour > 0.9) recommended = 'DN20–DN25';
  else if (volumeFlowM3PerHour > 0.4) recommended = 'DN20';

  const notes = [];
  if (mainLineLengthM > 40) {
    notes.push(
      'Длинная магистраль: на реальном проекте обязательно считать сопротивления и насос.',
    );
  }

  return {
    inputs: {
      heatLoadWatts: Q,
      deltaTSystemK: dt,
      mainLineLengthM: Number(mainLineLengthM) || 0,
    },
    massFlowKgPerSec: round(massFlowKgPerSec, 4),
    flowRateM3PerHour: round(volumeFlowM3PerHour, 3),
    recommendedPipeDiameter: recommended,
    recommendedVelocityRangeMPerSec: [0.2, 0.8],
    notes,
  };
}

