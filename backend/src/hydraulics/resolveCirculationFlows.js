/**
 * Назначение: SSOT расходов по зонам циркуляции (Q) для гидравлики.
 * Описание: Топологические сценарии — прямое подключение, смесительный узел ТП,
 * гидрострелка, приоритет ГВС (БКН).
 */

import { round } from '../utils/math.js';
import { thermalLoadToFlow } from './thermalLoadToFlow.js';

/** @typedef {'direct' | 'mixing_valve' | 'hydraulic_separator'} CirculationTopology */

/**
 * @param {import('./types').HydraulicsPipelineInput} dto
 * @returns {number}
 */
function sumRadiatorHeatWatts(dto) {
  return dto.circuits.radiators?.consumers?.reduce(
    (s, c) => s + c.heatLoadWatts,
    0,
  ) ?? 0;
}

/**
 * @param {import('./types').HydraulicsPipelineInput} dto
 * @returns {{
 *   rad: number;
 *   ufh: number;
 *   pRad: number;
 *   pUfh: number;
 *   dtBoiler: number;
 *   dtUfh: number;
 * }}
 */
function circuitBasics(dto) {
  return {
    rad: dto.circuits.radiators?.totalFlowRateM3PerHour ?? 0,
    ufh: dto.circuits.underfloor?.aggregate.flowRateM3PerHour ?? 0,
    pRad: sumRadiatorHeatWatts(dto),
    pUfh: dto.circuits.underfloor?.aggregate.heatLoadWatts ?? 0,
    dtBoiler: dto.source.deltaTK,
    dtUfh: dto.circuits.underfloor?.deltaTK ?? 10,
  };
}

/**
 * Первичный подмес смесительного узла: Q_ufh · (ΔT_ufh / ΔT_boiler).
 *
 * @param {number} qUfh
 * @param {number} dtUfh
 * @param {number} dtBoiler
 * @returns {number}
 */
export function mixingNodePrimaryBleedM3h(qUfh, dtUfh, dtBoiler) {
  if (qUfh <= 0 || dtBoiler <= 0) return 0;
  return round(qUfh * (dtUfh / dtBoiler), 3);
}

/**
 * @param {number} heatLoadWatts
 * @param {number} deltaTK
 * @returns {number}
 */
function flowFromHeatWatts(heatLoadWatts, deltaTK) {
  return thermalLoadToFlow({ heatLoadWatts, deltaTK }).flowRateM3PerHour;
}

/**
 * @param {import('./types').HydraulicsPipelineInput} dto
 * @returns {import('./types').HydraulicsCirculationFlowsResult}
 */
export function resolveCirculationFlows(dto) {
  const mode = dto.meta.heatingEmittersMode;
  const { rad, ufh, pRad, pUfh, dtBoiler, dtUfh } = circuitBasics(dto);
  const ufhCircuit = dto.circuits.underfloor;
  const mixing = ufhCircuit?.isMixingNodeRequired === true;
  const preset = ufhCircuit?.distributionPreset;

  /** @type {import('./types').HydraulicsCirculationZone[]} */
  const zones = [];
  /** @type {string[]} */
  const notes = [];
  /** @type {string[]} */
  const warnings = [];

  /** @type {CirculationTopology} */
  let topology = 'direct';

  const dhw = dto.circuits.dhw;
  let qDhw = 0;
  if (
    dhw?.scenario === 'storage'
    && dhw.indirectTank
    && dhw.hotWaterPowerKw > 0
  ) {
    qDhw = flowFromHeatWatts(dhw.hotWaterPowerKw * 1000, dtBoiler);
  }

  /**
   * @param {import('./types').HydraulicsCirculationZone} zone
   */
  const pushZone = (zone) => {
    zones.push(zone);
  };

  if (mode === 'radiators_only') {
    pushZone({
      zoneId: 'boiler_primary',
      label: 'Котловой контур (радиаторы)',
      pumpRole: 'main',
      designFlowM3PerHour: rad,
      heatLoadWatts: pRad,
      deltaTK: dtBoiler,
      requiresCatalogPump: true,
    });
  } else if (mode === 'ufh_only') {
    if (mixing && preset === 'collector_mixing_valve') {
      topology = 'mixing_valve';
      const qMain = flowFromHeatWatts(pUfh, dtBoiler);
      pushZone({
        zoneId: 'boiler_primary',
        label: 'Котловой контур (питание смесительного узла)',
        pumpRole: 'main',
        designFlowM3PerHour: qMain,
        heatLoadWatts: pUfh,
        deltaTK: dtBoiler,
        requiresCatalogPump: true,
      });
      pushZone({
        zoneId: 'ufh_floor',
        label: 'Контур теплого пола',
        pumpRole: 'zone',
        designFlowM3PerHour: ufh,
        heatLoadWatts: pUfh,
        deltaTK: dtUfh,
        requiresCatalogPump: true,
      });
    } else if (mixing && preset === 'hydraulic_separator') {
      topology = 'hydraulic_separator';
      const margin = dto.rules.primaryFlowMarginPercent;
      const qPrimaryBase = flowFromHeatWatts(pUfh, dtBoiler);
      const qPrimary = round(
        Math.max(qPrimaryBase, ufh * (1 + margin / 100)),
        3,
      );
      pushZone({
        zoneId: 'boiler_primary',
        label: 'Первичный контур (котёл → гидрострелка)',
        pumpRole: 'main',
        designFlowM3PerHour: qPrimary,
        heatLoadWatts: pUfh,
        deltaTK: dtBoiler,
        requiresCatalogPump: true,
      });
      pushZone({
        zoneId: 'ufh_floor_secondary',
        label: 'Вторичный контур: теплый пол',
        pumpRole: 'zone',
        designFlowM3PerHour: ufh,
        heatLoadWatts: pUfh,
        deltaTK: dtUfh,
        requiresCatalogPump: true,
      });
    } else {
      pushZone({
        zoneId: 'boiler_primary',
        label: 'Котловой контур (теплый пол)',
        pumpRole: 'main',
        designFlowM3PerHour: ufh,
        heatLoadWatts: pUfh,
        deltaTK: dtUfh,
        requiresCatalogPump: true,
      });
    }
  } else if (mixing && preset === 'hydraulic_separator') {
    topology = 'hydraulic_separator';
    const margin = dto.rules.primaryFlowMarginPercent;
    const pTotal = pRad + pUfh;
    const qPrimaryBase = flowFromHeatWatts(pTotal, dtBoiler);
    const qSecondarySum = rad + ufh;
    const qPrimary = round(
      Math.max(qPrimaryBase, qSecondarySum * (1 + margin / 100)),
      3,
    );
    pushZone({
      zoneId: 'boiler_primary',
      label: 'Первичный контур (котёл → гидрострелка)',
      pumpRole: 'main',
      designFlowM3PerHour: qPrimary,
      heatLoadWatts: pTotal,
      deltaTK: dtBoiler,
      requiresCatalogPump: true,
    });
    if (rad > 0) {
      pushZone({
        zoneId: 'radiators_secondary',
        label: 'Вторичный контур: радиаторы',
        pumpRole: 'zone',
        designFlowM3PerHour: rad,
        heatLoadWatts: pRad,
        deltaTK: dto.circuits.radiators?.flowDeltaTK ?? dtBoiler,
        requiresCatalogPump: true,
      });
    }
    if (ufh > 0) {
      pushZone({
        zoneId: 'ufh_floor_secondary',
        label: 'Вторичный контур: теплый пол',
        pumpRole: 'zone',
        designFlowM3PerHour: ufh,
        heatLoadWatts: pUfh,
        deltaTK: dtUfh,
        requiresCatalogPump: true,
      });
    }
  } else if (mixing && preset === 'collector_mixing_valve') {
    topology = 'mixing_valve';
    const qMainThermal = flowFromHeatWatts(pRad + pUfh, dtBoiler);
    const qUfhPrimary = mixingNodePrimaryBleedM3h(ufh, dtUfh, dtBoiler);
    const qMainMixing = round(rad + qUfhPrimary, 3);
    if (
      qMainThermal > 0
      && Math.abs(qMainThermal - qMainMixing) / qMainThermal > 0.05
    ) {
      warnings.push(
        `Расход котлового контура по балансу мощностей (${qMainThermal} м³/ч) `
        + `и по подмесу ТП (${qMainMixing} м³/ч) расходятся >5 % — использован тепловой баланс.`,
      );
    }
    pushZone({
      zoneId: 'boiler_primary',
      label: 'Котловой контур (радиаторы + подмес ТП)',
      pumpRole: 'main',
      designFlowM3PerHour: qMainThermal,
      heatLoadWatts: pRad + pUfh,
      deltaTK: dtBoiler,
      requiresCatalogPump: true,
    });
    if (ufh > 0) {
      pushZone({
        zoneId: 'ufh_floor',
        label: 'Контур теплого пола (насос смесительного узла)',
        pumpRole: 'zone',
        designFlowM3PerHour: ufh,
        heatLoadWatts: pUfh,
        deltaTK: dtUfh,
        requiresCatalogPump: true,
      });
    }
  } else {
    topology = 'direct';
    const qCombined = round(rad + ufh, 3);
    pushZone({
      zoneId: 'boiler_primary',
      label: 'Смешанная система (радиаторы + ТП)',
      pumpRole: 'main',
      designFlowM3PerHour: qCombined,
      heatLoadWatts: pRad + pUfh,
      deltaTK: dtBoiler,
      requiresCatalogPump: true,
    });
  }

  const boilerZone = zones.find((z) => z.zoneId === 'boiler_primary');
  const primaryMainLineFlowM3PerHour = boilerZone?.designFlowM3PerHour ?? 0;

  if (qDhw > 0 && boilerZone) {
    const qHeating = boilerZone.designFlowM3PerHour;
    boilerZone.designFlowM3PerHour = round(Math.max(qHeating, qDhw), 3);
    boilerZone.heatingFlowM3PerHour = qHeating;
    boilerZone.dhwPriorityFlowM3PerHour = qDhw;
    notes.push(
      'Приоритет ГВС: при прогреве БКН контуры отопления отсекаются автоматикой котла.',
    );
    if (qDhw > qHeating) {
      notes.push(
        `Расчётный расход котлового насоса определён по змеевику БКН `
        + `(${qDhw} м³/ч), а не по отоплению (${qHeating} м³/ч).`,
      );
    }
    pushZone({
      zoneId: 'dhw_coil',
      label: 'Змеевик БКН (режим прогрева)',
      pumpRole: 'dhw',
      designFlowM3PerHour: qDhw,
      heatLoadWatts: dhw.hotWaterPowerKw * 1000,
      deltaTK: dtBoiler,
      requiresCatalogPump: false,
      simultaneousWithHeating: false,
    });
  }

  const boilerPumpDesignFlowM3PerHour =
    boilerZone?.designFlowM3PerHour ?? primaryMainLineFlowM3PerHour;

  return {
    zones,
    topology,
    primaryMainLineFlowM3PerHour,
    boilerPumpDesignFlowM3PerHour,
    mixingNodePrimaryBleedM3PerHour: mixing
      ? mixingNodePrimaryBleedM3h(ufh, dtUfh, dtBoiler)
      : 0,
    notes,
    warnings,
  };
}

/**
 * Расход на магистрали графа (котёл → коллектор / гидрострелка).
 *
 * @param {import('./types').HydraulicsPipelineInput} dto
 * @returns {number}
 */
export function resolvePrimaryMainLineFlowM3h(dto) {
  return resolveCirculationFlows(dto).primaryMainLineFlowM3PerHour;
}

/**
 * Расчётный расход котлового насоса с учётом приоритета ГВС.
 *
 * @param {import('./types').HydraulicsPipelineInput} dto
 * @returns {number}
 */
export function resolveDesignPumpFlowM3h(dto) {
  return resolveCirculationFlows(dto).boilerPumpDesignFlowM3PerHour;
}
