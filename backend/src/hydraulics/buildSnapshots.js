/**
 * Назначение: сборка HydraulicsPipelineInput из блоков отчёта после matchEquipment.
 * Описание: Pure Pipeline не пересчитывает тепло — только агрегирует готовые поля upstream.
 */

import { SCHEME_BOILER_MAX_COMBI } from '../../../shared/heatingMatchingSchemes.js';
import { parseConnectionDiametersMm } from './parseConnectionDiameter.js';
import {
  estimateBranchLengthM,
  hydraulicsRulesFromAppliance,
  resolvePipelineEmittersMode,
} from './resolveEmittersMode.js';
import { round } from '../utils/math.js';

/**
 * @param {import('../types/shared-types').BuildingInput | undefined | null} building
 * @returns {Map<string, number>}
 */
function roomFloorById(building) {
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const room of building?.rooms ?? []) {
    if (room?.id) map.set(room.id, Number(room.floor) || 1);
  }
  return map;
}

/**
 * @param {object} args
 * @param {import('../types/shared-types').CalcRequestBody} args.input
 * @param {import('../types/shared-types').HotWaterReport} args.hotWater
 * @param {import('../types/shared-types').UnderfloorHeatingReport | null | undefined} args.underfloorHeating
 * @param {import('../types/shared-types').MatchingReport} args.matching
 * @param {import('./types').HydraulicsApplianceRules} args.hydraulicsRules
 * @returns {import('./types').HydraulicsPipelineInput}
 */
export function buildHydraulicsSnapshots({
  input,
  hotWater,
  underfloorHeating,
  matching,
  hydraulicsRules,
}) {
  const rules = hydraulicsRulesFromAppliance(hydraulicsRules);
  const heatingSystem = input.heatingSystem ?? {};
  const objectTypeRaw = input.building?.objectMeta?.objectType;
  const objectType =
    objectTypeRaw === 'apartment' || objectTypeRaw === 'house' ? objectTypeRaw : 'house';

  const emittersMode = resolvePipelineEmittersMode(heatingSystem, underfloorHeating);
  const dhwMatchingScheme =
    heatingSystem.hotWaterBoilerPowerMatchingScheme ?? SCHEME_BOILER_MAX_COMBI;

  const supplyC = Number(heatingSystem.supplyC) || 75;
  const returnC = Number(heatingSystem.returnC) || 65;
  const deltaTFromSurvey = input.hydraulics?.deltaTSystemK;
  const deltaTK =
    typeof deltaTFromSurvey === 'number' && deltaTFromSurvey > 0
      ? deltaTFromSurvey
      : Math.max(0.1, supplyC - returnC);

  const selected = matching.boiler?.selected ?? matching.boiler?.proposal;
  const connectionNominalMm = parseConnectionDiametersMm(
    selected?.connectionDiameters ?? [],
  );

  /** @type {import('./types').HydraulicsSourceNode} */
  const source = {
    catalogBoilerId: selected?.id ?? selected?.model,
    supplyC,
    returnC,
    deltaTK,
    requiredKw: matching.boiler?.requiredKw ?? 0,
    connectionNominalMm,
    mountingType: selected?.mountingType,
  };

  /** @type {import('./types').HydraulicsCircuits} */
  const circuits = {};

  const floors = roomFloorById(input.building);

  if (emittersMode !== 'ufh_only' && matching.radiators?.byRoom?.length) {
    const radInputs = matching.radiators.inputs;
    const radSupply = radInputs?.supplyC ?? supplyC;
    const radReturn = radInputs?.returnC ?? returnC;
    const radDelta = Math.max(0.1, radSupply - radReturn);

    /** @type {import('./types').HydraulicsRadiatorConsumer[]} */
    const consumers = matching.radiators.byRoom
      .filter((r) => (r.radiatorDesignWatts ?? 0) > 0)
      .map((r) => ({
        roomId: r.roomId,
        roomName: r.roomName,
        floor: floors.get(r.roomId) ?? 1,
        heatLoadWatts: r.radiatorDesignWatts,
        flowRateM3PerHour: r.flowRateM3PerHour ?? 0,
      }));

    const totalFlow = round(
      consumers.reduce((s, c) => s + c.flowRateM3PerHour, 0),
      3,
    );

    circuits.radiators = {
      thermalRegime: {
        supplyC: radSupply,
        returnC: radReturn,
        deltaTK: radDelta,
      },
      connectionType: radInputs?.radiatorConnection === 'bottom' ? 'bottom' : 'side',
      consumers,
      totalFlowRateM3PerHour: totalFlow,
    };
  }

  if (
    (emittersMode === 'ufh_only' || emittersMode === 'mixed')
    && underfloorHeating?.rooms?.length
  ) {
    /** @type {import('./types').HydraulicsUfhRoom[]} */
    const ufhRooms = underfloorHeating.rooms.map((room) => ({
      roomId: room.roomId,
      roomName: room.roomName,
      floor: floors.get(room.roomId) ?? 1,
      areaM2: room.areaM2,
      pipeSpacingMm: room.pipeSpacingMm,
      circuitSupplyC: room.circuitSupplyC,
      circuitReturnC: room.circuitReturnC,
      heatLoadWatts: room.heatLoadWatts ?? room.heatFluxUpWatts,
      flowRateM3PerHour: room.flowRateM3PerHour ?? 0,
      ...(room.loopsCount != null ? { loopsCount: room.loopsCount } : {}),
      ...(room.loops?.length ? { loops: room.loops } : {}),
    }));

    /** @type {import('./types').HydraulicsMixingNodeSnapshot | undefined} */
    let mixingNodeSnap;
    const mn = underfloorHeating.mixingNode;
    if (mn && typeof mn.flowRateM3PerHour === 'number') {
      mixingNodeSnap = {
        flowRateM3PerHour: mn.flowRateM3PerHour,
        headMetersMin: mn.headMetersMin,
        valveKvsMin: mn.valveKvsMin,
        boilerSupplyC: mn.boilerSupplyC,
        floorCircuitSupplyC: mn.floorCircuitSupplyC,
      };
    }

    circuits.underfloor = {
      deltaTK: underfloorHeating.underfloorHydraulics?.deltaTK ?? 10,
      aggregate: {
        heatLoadWatts: underfloorHeating.totalHeatFluxUpWatts ?? 0,
        flowRateM3PerHour:
          underfloorHeating.underfloorHydraulics?.flowRateM3PerHour ?? 0,
      },
      isMixingNodeRequired: underfloorHeating.isMixingNodeRequired === true,
      ...(underfloorHeating.distributionPreset
        ? { distributionPreset: underfloorHeating.distributionPreset }
        : {}),
      ...(mixingNodeSnap ? { mixingNode: mixingNodeSnap } : {}),
      rooms: ufhRooms,
    };
  }

  if (hotWater && (hotWater.peakFlowLps != null || hotWater.hotWaterPowerKw != null)) {
    /** @type {import('./types').HydraulicsDhwCircuit} */
    const dhw = {
      scenario: hotWater.dhwSupplyScenario === 'storage' ? 'storage' : 'flowThrough',
      peakFlowLps: hotWater.peakFlowLps ?? 0,
      hotWaterPowerKw: hotWater.hotWaterPowerKw ?? 0,
      designColdWaterC: hotWater.designColdWaterC,
      hotWaterC: hotWater.hotWaterC,
    };

    const indirect = matching.indirectWaterHeater?.selected;
    if (indirect?.specs?.volumeLiters) {
      dhw.indirectTank = {
        volumeLiters: indirect.specs.volumeLiters,
        coilPowerKw:
          matching.indirectWaterHeater?.coilPowerKw
          ?? matching.indirectWaterHeater?.effectiveHeatPowerKw
          ?? 0,
      };
    }

    circuits.dhw = dhw;
  }

  const surveyMain = input.hydraulics?.mainLineLengthM;
  const mainLineLengthM =
    typeof surveyMain === 'number' && surveyMain >= 0
      ? surveyMain
      : rules.defaultLengthsM.mainLine;

  /** @type {import('./types').HydraulicsBranchLayout[]} */
  const radiatorBranches = (circuits.radiators?.consumers ?? []).map((c) => ({
    roomId: c.roomId,
    estimatedLengthM: estimateBranchLengthM(
      c.floor,
      rules.defaultLengthsM.radiatorBranch,
    ),
  }));

  /** @type {import('./types').HydraulicsBranchLayout[]} */
  const ufhBranches = (circuits.underfloor?.rooms ?? []).map((r) => ({
    roomId: r.roomId,
    estimatedLengthM: estimateBranchLengthM(
      r.floor,
      rules.defaultLengthsM.ufhCollectorBranch,
    ),
  }));

  /** @type {import('./types').HydraulicsPipelineInput} */
  return {
    schemaVersion: 1,
    meta: {
      heatingEmittersMode: emittersMode,
      objectType,
      dhwMatchingScheme,
    },
    source,
    circuits,
    layout: {
      mainLineLengthM,
      radiatorBranches,
      ufhBranches,
      ...(input.hydraulics?.pipeMaterialPreference
        ? { pipeMaterialPreference: input.hydraulics.pipeMaterialPreference }
        : {}),
    },
    rules,
  };
}
