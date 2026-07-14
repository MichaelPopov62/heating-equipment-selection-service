/**
 * Назначение: ориентиры насоса и клапана узла смешения ТП.
 * Описание: Q = P×0.86/(Δt×ρ), Kvs, напор H — без подбора артикулов из каталога.
 */

import { round } from '../utils/math.js';

/** Плотность воды, кг/л (≈1). */
const RHO_KG_PER_L = 1;

/**
 * @param {object} args
 * @param {number} args.powerKw — суммарная полезная мощность ТП, кВт
 * @param {number} [args.deltaTK=10]
 * @param {'collector_mixing_valve' | 'hydraulic_separator'} [args.distributionPreset]
 * @param {import('../dhw/types.js').UnderfloorHeatingMixingNodeRules} [args.mixingNodeRules]
 * @returns {import('../types/shared-types.js').UfhMixingNodeSpec}
 */
export function computeUfhMixingNodeSpec(args) {
  const {
    powerKw,
    deltaTK,
    distributionPreset = 'collector_mixing_valve',
    mixingNodeRules,
  } = args;

  const dt = deltaTK ?? mixingNodeRules?.deltaTK ?? 10;
  const valvePressureDropBar = mixingNodeRules?.valvePressureDropBar ?? 0.17;
  const headCollector = mixingNodeRules?.headMetersMinCollector ?? 3;
  const headSeparator = mixingNodeRules?.headMetersMinHydraulicSeparator ?? 5;

  const p = Number(powerKw) || 0;
  const flowRateM3PerHour =
    dt > 0 && p > 0 ? round((p * 0.86) / (dt * RHO_KG_PER_L), 3) : 0;

  const headMetersMin =
    distributionPreset === 'hydraulic_separator' ? headSeparator : headCollector;

  const valveKvsMin =
    flowRateM3PerHour > 0 && valvePressureDropBar > 0
      ? round(flowRateM3PerHour / valvePressureDropBar, 2)
      : 0;

  /** @type {string[]} */
  const notes = [
    `Ориентир расхода контура ТП: не менее ${flowRateM3PerHour} м³/ч (Δt = ${dt} K).`,
    `Насос контура ТП: напор не менее ${headMetersMin} м.в.ст.`,
    `Трёхходовой смесительный клапан: Kvs от ${valveKvsMin} м³/ч (Δp ≈ ${valvePressureDropBar} бар).`,
  ];

  return {
    isMixingNodeRequired: true,
    deltaTK: dt,
    powerKw: round(p, 2),
    flowRateM3PerHour,
    headMetersMin,
    valveKvsMin,
    distributionPreset,
    notes,
  };
}
