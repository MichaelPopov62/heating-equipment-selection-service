/**
 * Назначение: smoke-тест HydraulicsPipelineInput и pipeline.
 * Описание: buildSnapshots → validate → runHydraulicsPipeline на фикстурах calc.
 */

import { getReferenceBundle } from '../src/reference/public.js';
import { calculateHeatLossForBuilding } from '../src/logic/heatlossByRooms.js';
import { calculateUnderfloorHeating } from '../src/logic/warmFloorCalc.js';
import { calculateHotWaterDemand } from '../src/logic/hotWater.js';
import { enrichUnderfloorHeatingLoopHydraulics } from '../src/logic/ufhLoopHydraulics.js';
import { matchEquipment } from '../src/matching/public.js';
import { toCalcRuntimeContext } from '../src/reference/toCalcRuntimeContext.js';
import {
  buildHydraulicsSnapshots,
  runHydraulicsPipeline,
  validateHydraulicsPipelineInput,
} from '../src/hydraulics/public.js';

/** @param {string} label
 * @param {import('../src/types/shared-types').CalcRequestBody} input
 */
async function runFixture(label, input) {
  const bundle = await getReferenceBundle();
  const ctx = toCalcRuntimeContext(bundle);
  const temps = {
    insideC: input.building?.temps?.insideC ?? 20,
    outsideC: input.building?.temps?.outsideC ?? -5,
  };
  const heatLoss = calculateHeatLossForBuilding({ temps, building: input.building });
  const underfloorHeating = calculateUnderfloorHeating({
    temps,
    building: input.building,
    heatingSystem: input.heatingSystem,
    heatLoss,
    ufhPresets: ctx.ufhPresets,
    maxUfhLoopLengthM: ctx.appliances.byKind.hydraulics.maxUfhLoopLengthM,
  });
  if (underfloorHeating?.rooms?.length) {
    enrichUnderfloorHeatingLoopHydraulics(underfloorHeating, {
      catalog: ctx.catalog,
      hydraulicsRules: ctx.appliances.byKind.hydraulics,
      materialPreference: input.hydraulics?.pipeMaterialPreference,
    });
  }
  const hotWater = calculateHotWaterDemand(
    { ...(input.hotWater ?? {}), objectType: input.building?.objectMeta?.objectType ?? 'house' },
    ctx.waterNorms,
  );
  const { matching, hotWaterForCalculations } = matchEquipment({
    heatLoss,
    hotWater,
    heatingSystem: input.heatingSystem ?? {},
    building: input.building,
    underfloorHeating,
    hydraulics: input.hydraulics,
    ctx,
  });

  const dto = buildHydraulicsSnapshots({
    input,
    hotWater: hotWaterForCalculations ?? hotWater,
    underfloorHeating,
    matching,
    hydraulicsRules: ctx.appliances.byKind.hydraulics,
  });

  await validateHydraulicsPipelineInput(dto);
  const result = runHydraulicsPipeline({ dto, catalog: ctx.catalog });

  if (label === 'radiators_only') {
    const flowDt = matching.radiators?.inputs?.flowDeltaTK;
    if (flowDt !== 20) {
      throw new Error(`${label}: ожидался flowDeltaTK=20, получено ${flowDt}`);
    }
    if (dto.circuits.radiators?.flowDeltaTK !== 20) {
      throw new Error(`${label}: dto.flowDeltaTK должен быть 20`);
    }
    if (dto.circuits.radiators?.thermalRegime.deltaTK !== 10) {
      throw new Error(`${label}: thermalRegime.deltaTK графика должен быть 10 (75/65)`);
    }
    const branchPipe = result.hydraulicsMatching.pipes.find((p) =>
      p.edgeId.includes('_to_rad_'),
    );
    const branchMax = dto.rules.velocityLimitsMps.branchMax;
    if (branchPipe && branchPipe.velocityMps > branchMax) {
      throw new Error(
        `${label}: скорость ветки радиатора ${branchPipe.velocityMps} > ${branchMax} м/с`,
      );
    }
  }

  if (result.hydraulics.flowRateM3PerHour == null) {
    throw new Error(`${label}: нет flowRateM3PerHour`);
  }
  if (!result.hydraulics.graph?.edges?.length) {
    throw new Error(`${label}: пустой граф`);
  }

  if (!result.hydraulicsMatching.proposal?.pipeSegments?.length) {
    throw new Error(`${label}: нет proposal.pipeSegments`);
  }

  const loops = result.hydraulics.pressure?.circulationLoops ?? [];
  if (!loops.length) {
    throw new Error(`${label}: нет circulationLoops`);
  }
  const critical = result.hydraulics.pressure?.criticalLoop;
  if (!critical?.isCritical) {
    throw new Error(`${label}: не определено критическое кольцо`);
  }
  if ((result.hydraulics.pressure?.criticalPressureDropKPa ?? 0) <= 0) {
    throw new Error(`${label}: criticalPressureDropKPa должен быть > 0`);
  }

  const graph = result.hydraulics.graph;
  if (graph?.edges?.length && dto.circuits.radiators) {
    const edgesById = new Map(graph.edges.map((e) => [e.id, e]));
    const nodesById = new Map((graph.nodes ?? []).map((n) => [n.id, n]));
    const radBranchEdges = graph.edges.filter((e) => {
      if (e.segmentRole !== 'branch') return false;
      const toKind = nodesById.get(e.to)?.kind;
      return toKind === 'radiator_consumer' || toKind === 'radiator_manifold';
    });
    const sumBranchFlow = radBranchEdges.reduce(
      (s, e) => s + e.designFlowM3PerHour,
      0,
    );
    const totalRad = dto.circuits.radiators.totalFlowRateM3PerHour;
    if (Math.abs(sumBranchFlow - totalRad) > 0.002) {
      throw new Error(
        `${label}: Σ Q веток радиаторов ${sumBranchFlow} ≠ total ${totalRad} м³/ч`,
      );
    }
    for (const pipe of result.hydraulicsMatching.pipes) {
      const edge = edgesById.get(pipe.edgeId);
      if (edge?.segmentRole !== 'branch') continue;
      const toNode = nodesById.get(edge.to);
      if (toNode?.kind !== 'radiator_consumer' && toNode?.kind !== 'radiator_manifold') continue;
      if (pipe.internalDiameterMm < dto.rules.branchMinInternalDiameterMm - 0.01) {
        throw new Error(
          `${label}: ветка ${pipe.edgeId} Dвн ${pipe.internalDiameterMm} `
          + `< branchMin ${dto.rules.branchMinInternalDiameterMm}`,
        );
      }
      if (pipe.catalogPipeId === 'p-27' && !pipe.velocityLimitExceeded) {
        throw new Error(
          `${label}: ветка ${pipe.edgeId} ошибочно получила p-27 (Ø63) без перегрузки`,
        );
      }
    }

    const mainTransitMin = dto.rules.mainTransitMinInternalDiameterMm;
    for (const edge of graph.edges) {
      if (edge.isMainLine !== true) continue;
      const pipe = result.hydraulicsMatching.pipes.find((p) => p.edgeId === edge.id);
      if (!pipe) {
        throw new Error(`${label}: нет подбора трубы для транзита ${edge.id}`);
      }
      if (pipe.catalogPoolExhausted) {
        throw new Error(`${label}: транзит ${edge.id}: исчерпан каталог по Dвн`);
      }
      if (pipe.internalDiameterMm < mainTransitMin - 0.01) {
        throw new Error(
          `${label}: транзит ${edge.id} Dвн ${pipe.internalDiameterMm} < ${mainTransitMin}`,
        );
      }
      if (!pipe.mainTransitGuardApplied) {
        throw new Error(`${label}: транзит ${edge.id} без mainTransitGuardApplied`);
      }
      if (pipe.catalogPipeId === 'p-01') {
        throw new Error(`${label}: транзит ${edge.id} ошибочно получил p-01`);
      }
    }
  }

  if (label.startsWith('radiators_wiring_')) {
    const graphW = result.hydraulics.graph;
    const wiring = dto.layout.radiatorWiringSystemType;
    if (!wiring) {
      throw new Error(`${label}: не задан radiatorWiringSystemType в layout`);
    }
    const consumers = dto.circuits.radiators?.consumers ?? [];
    const n = consumers.length;

    if (label === 'radiators_wiring_dead_end') {
      const trunks = graphW?.edges?.filter((e) => e.segmentRole === 'trunk') ?? [];
      if (trunks.length !== Math.max(n - 1, 0)) {
        throw new Error(`${label}: trunk-рёбер ${trunks.length}, ожидалось ${Math.max(n - 1, 0)}`);
      }
      if (n >= 2) {
        const total = dto.circuits.radiators?.totalFlowRateM3PerHour ?? 0;
        const interTrunks = trunks.filter((e) => e.from.startsWith('rad_trunk_j_'));
        if (interTrunks[0] && Math.abs(interTrunks[0].designFlowM3PerHour - (total - (consumers[0]?.flowRateM3PerHour ?? 0))) > 0.02) {
          throw new Error(
            `${label}: первый trunk Q=${interTrunks[0].designFlowM3PerHour} `
            + `≠ ${total - (consumers[0]?.flowRateM3PerHour ?? 0)}`,
          );
        }
        const lastFlow = consumers[n - 1]?.flowRateM3PerHour ?? 0;
        const lastTrunk = interTrunks[interTrunks.length - 1];
        if (lastTrunk && Math.abs(lastTrunk.designFlowM3PerHour - lastFlow) > 0.01) {
          throw new Error(`${label}: последний trunk Q=${lastTrunk.designFlowM3PerHour} ≠ ${lastFlow}`);
        }
        const trunkPipes = interTrunks
          .map((edge) => {
            const pipe = result.hydraulicsMatching.pipes.find((p) => p.edgeId === edge.id);
            return pipe ? { edge, pipe } : null;
          })
          .filter(Boolean);
        for (let ti = 1; ti < trunkPipes.length; ti += 1) {
          const prev = trunkPipes[ti - 1];
          const curr = trunkPipes[ti];
          if (curr.pipe.internalDiameterMm > prev.pipe.internalDiameterMm) {
            throw new Error(
              `${label}: trunk ${curr.edge.id} Dвн ${curr.pipe.internalDiameterMm} `
              + `> upstream ${prev.edge.id} Dвн ${prev.pipe.internalDiameterMm}`,
            );
          }
        }
      }
    }

    if (label === 'radiators_wiring_pass') {
      const trunks = graphW?.edges?.filter((e) => e.segmentRole === 'trunk') ?? [];
      const total = dto.circuits.radiators?.totalFlowRateM3PerHour ?? 0;
      for (const edge of trunks) {
        if (Math.abs(edge.designFlowM3PerHour - total) > 0.01) {
          throw new Error(`${label}: trunk ${edge.id} Q=${edge.designFlowM3PerHour} ≠ total ${total}`);
        }
      }
    }

    if (label === 'radiators_wiring_manifold') {
      const manifold = graphW?.nodes?.find((node) => node.kind === 'radiator_distribution_manifold');
      if (!manifold) {
        throw new Error(`${label}: нет radiator_distribution_manifold`);
      }
      if (graphW?.nodes?.some((node) => node.id === 'rad_micro_manifold')) {
        throw new Error(`${label}: не ожидался rad_micro_manifold`);
      }
      const branches = graphW?.edges?.filter(
        (e) => e.from === 'rad_distribution_manifold' && e.segmentRole === 'branch',
      ) ?? [];
      if (branches.length !== n) {
        throw new Error(`${label}: веток от коллектора ${branches.length}, ожидалось ${n}`);
      }
    }
  }

  if (label === 'apartment_mixed_ufh_micro_branches') {
    const hasManifold = result.hydraulics.graph?.nodes?.some(
      (n) => n.kind === 'radiator_manifold',
    );
    if (!hasManifold) {
      throw new Error(`${label}: ожидался узел radiator_manifold для микроветок`);
    }
    const manifoldEdge = result.hydraulics.graph?.edges?.find(
      (e) => e.to === 'rad_micro_manifold',
    );
    if (!manifoldEdge) {
      throw new Error(`${label}: нет ребра к rad_micro_manifold`);
    }
  }

  if (label === 'apartment_mixed_ufh_mixing_valve') {
    if (result.hydraulicsMatching.topology !== 'mixing_valve') {
      throw new Error(
        `${label}: ожидалась топология mixing_valve, получена ${result.hydraulicsMatching.topology}`,
      );
    }
    const mainEdge = result.hydraulics.graph?.edges?.find((e) => e.id === 'e_boiler_main');
    if (mainEdge?.isMainLine !== true) {
      throw new Error(`${label}: e_boiler_main без isMainLine`);
    }
    const mixingEdge = result.hydraulics.graph?.edges?.find((e) => e.id === 'e_main_to_mixing');
    if (mixingEdge?.isMainLine !== true) {
      throw new Error(`${label}: e_main_to_mixing без isMainLine`);
    }
    const boilerMainPipe = result.hydraulicsMatching.pipes.find(
      (p) => p.edgeId === 'e_boiler_main',
    );
    if (!boilerMainPipe || boilerMainPipe.internalDiameterMm < 20) {
      throw new Error(`${label}: e_boiler_main без трубы Dвн ≥ 20`);
    }
  }

  if (underfloorHeating?.rooms?.length) {
    for (const room of underfloorHeating.rooms) {
      if (!room.loops?.length) {
        throw new Error(`${label}: комната ${room.roomId} без loops после enrich`);
      }
      for (const loop of room.loops) {
        const hyd = loop.hydraulics;
        if (!hyd?.catalogPipeId || hyd.velocityMps == null || hyd.pressureDropKPa == null) {
          throw new Error(`${label}: петля ${loop.loopId} без полной гидравлики`);
        }
        if (hyd.pressureDropKPa > ctx.appliances.byKind.hydraulics.maxUfhLoopPressureDropKPa) {
          throw new Error(
            `${label}: петля ${loop.loopId} Δp ${hyd.pressureDropKPa} > лимита`,
          );
        }
      }
    }
    const ufhPipeSegments = result.hydraulicsMatching.proposal?.pipeSegments?.filter(
      (s) => s.segmentRole === 'ufh_loop' || s.segmentRole === 'ufh_collector_transit',
    ) ?? [];
    if (label.includes('ufh') && ufhPipeSegments.length === 0) {
      throw new Error(`${label}: нет pipeSegments ТП в proposal`);
    }

    const loopsById = new Map();
    for (const room of underfloorHeating.rooms) {
      for (const loop of room.loops ?? []) {
        loopsById.set(loop.loopId, loop.loopLengthM);
      }
    }
    for (const edge of graph.edges) {
      if (edge.segmentRole !== 'ufh_loop') continue;
      const loopId = edge.to.replace(/^ufh_loop_/, '');
      const expected = loopsById.get(loopId);
      if (expected == null) continue;
      if (Math.abs(edge.lengthM - expected) > 0.15) {
        throw new Error(
          `${label}: ребро ${edge.id} lengthM=${edge.lengthM} ≠ loopLengthM=${expected}`,
        );
      }
      if (edge.lengthM > expected + 0.5) {
        throw new Error(
          `${label}: ребро ${edge.id} содержит транзит в длине петли (${edge.lengthM} > ${expected})`,
        );
      }
    }

    const transitEdges = graph.edges.filter(
      (e) => e.segmentRole === 'ufh_collector_transit',
    );
    const floorsInDto = new Set(
      (dto.layout.ufhCollectorTransit ?? []).map((t) => t.floor),
    );
    if (floorsInDto.size > 0 && transitEdges.length !== floorsInDto.size) {
      throw new Error(
        `${label}: транзитов коллектора ${transitEdges.length} ≠ этажей ${floorsInDto.size}`,
      );
    }
  }

  console.log(
    `OK ${label}: Q=${result.hydraulics.flowRateM3PerHour} m³/h, edges=${result.hydraulics.graph.edges.length}, pipes=${result.hydraulicsMatching.pipes.length}, critical=${critical.label} Δp=${critical.pressureDropKPa} kPa, balancing=${result.hydraulics.pressure?.balancingRecommendations?.length ?? 0}, proposalTotal=${result.hydraulicsMatching.proposal.estimatedTotalPrice} UAH`,
  );
}

const baseBuilding = {
  temps: { insideC: 20, outsideC: -5 },
  objectMeta: {
    objectType: 'house',
    floors: 1,
    roomsCount: 1,
    externalWalls: {
      presetId: 'wall_gas_concrete_d500',
      thicknessMm: 375,
      facadeSystem: 'none',
    },
  },
  rooms: [{
    id: 'r1',
    name: 'Комната',
    type: 'living',
    floor: 1,
    topBoundary: 'heated',
    bottomBoundary: 'heated',
    areaM2: 10,
    heightM: 2.7,
  }],
  envelopeElements: [{
    kind: 'wall',
    roomId: 'r1',
    construction: 'наружная стена',
    presetId: 'wall_gas_concrete_d500',
    areaM2: 12,
    orientation: 'N',
  }],
};

const houseThreeRooms = {
  temps: { insideC: 20, outsideC: -5 },
  objectMeta: {
    objectType: 'house',
    floors: 1,
    roomsCount: 3,
    externalWalls: {
      presetId: 'wall_gas_concrete_d500',
      thicknessMm: 375,
      facadeSystem: 'none',
    },
  },
  rooms: [
    { id: 'r1', name: 'Гостиная', type: 'living', floor: 1, topBoundary: 'heated', bottomBoundary: 'heated', areaM2: 20, heightM: 2.7 },
    { id: 'r2', name: 'Спальня', type: 'living', floor: 1, topBoundary: 'heated', bottomBoundary: 'heated', areaM2: 14, heightM: 2.7 },
    { id: 'r3', name: 'Кухня', type: 'kitchen', floor: 1, topBoundary: 'heated', bottomBoundary: 'heated', areaM2: 12, heightM: 2.7 },
  ],
  envelopeElements: [
    { kind: 'wall', roomId: 'r1', name: 'Стена r1', construction: 'наружная стена', presetId: 'wall_gas_concrete_d500', areaM2: 14, orientation: 'N' },
    { kind: 'window', roomId: 'r1', construction: 'окно', presetId: 'window_pvc_double_chamber_3_glass', areaM2: 2.5, orientation: 'N', openingWidthMm: 1500, openingHeightMm: 1400, name: 'Окно r1' },
    { kind: 'wall', roomId: 'r2', name: 'Стена r2', construction: 'наружная стена', presetId: 'wall_gas_concrete_d500', areaM2: 10, orientation: 'E' },
    { kind: 'window', roomId: 'r2', construction: 'окно', presetId: 'window_pvc_double_chamber_3_glass', areaM2: 2, orientation: 'E', openingWidthMm: 1200, openingHeightMm: 1200, name: 'Окно r2' },
    { kind: 'wall', roomId: 'r3', name: 'Стена r3', construction: 'наружная стена', presetId: 'wall_gas_concrete_d500', areaM2: 9, orientation: 'W' },
    { kind: 'window', roomId: 'r3', construction: 'окно', presetId: 'window_pvc_double_chamber_3_glass', areaM2: 2, orientation: 'W', openingWidthMm: 1200, openingHeightMm: 1200, name: 'Окно r3' },
  ],
};

const wiringHydraulicsBase = {
  mainLineLengthM: 9,
  deltaTSystemK: 20,
  radiatorBranchOverrides: [
    { roomId: 'r1', pipeLengthToEquipmentM: 3 },
    { roomId: 'r2', pipeLengthToEquipmentM: 4 },
    { roomId: 'r3', pipeLengthToEquipmentM: 5 },
  ],
};

await runFixture('radiators_only', {
  building: baseBuilding,
  heatingSystem: {
    supplyC: 75,
    returnC: 65,
    insideC: 20,
    thermalRegimePreset: 'traditional_dt50_75_65',
    radiatorConnection: 'side',
  },
  hydraulics: { mainLineLengthM: 6, deltaTSystemK: 20 },
});

for (const wiringType of ['two-pipe-dead-end', 'two-pipe-pass', 'manifold']) {
  const suffix = wiringType === 'two-pipe-dead-end'
    ? 'dead_end'
    : wiringType === 'two-pipe-pass'
      ? 'pass'
      : 'manifold';
  await runFixture(`radiators_wiring_${suffix}`, {
    building: houseThreeRooms,
    heatingSystem: {
      supplyC: 75,
      returnC: 65,
      insideC: 20,
      thermalRegimePreset: 'traditional_dt50_75_65',
      radiatorConnection: 'side',
    },
    hydraulics: {
      ...wiringHydraulicsBase,
      radiatorWiringSystemType: wiringType,
    },
  });
}

await runFixture('ufh_only', {
  building: {
    ...baseBuilding,
    rooms: [{
      ...baseBuilding.rooms[0],
      underfloorHeating: {
        enabled: true,
        basePresetId: 'ufh_base_interstory_screed_65',
        finishMaterialId: 'ceramic_tile',
        pipeSpacingMm: 150,
      },
    }],
  },
  heatingSystem: {
    supplyC: 40,
    returnC: 30,
    insideC: 20,
    waterUnderfloorHeating: true,
    heatingEmittersMode: 'ufh_only',
    ufhPresetId: 'ufh_only',
  },
  hydraulics: { mainLineLengthM: 4 },
});

await runFixture('mixed_radiators_ufh', {
  building: {
    ...baseBuilding,
    objectMeta: {
      ...baseBuilding.objectMeta,
      objectType: 'apartment',
      roomsCount: 2,
    },
    rooms: [
      {
        ...baseBuilding.rooms[0],
        id: 'r1',
        name: 'Комната',
        roomExteriorLayout: 'facade',
        areaM2: 20,
      },
      {
        ...baseBuilding.rooms[0],
        id: 'r2',
        name: 'Кухня',
        type: 'kitchen',
        roomExteriorLayout: 'facade',
        areaM2: 12,
        underfloorHeating: {
          enabled: true,
          basePresetId: 'ufh_base_interstory_screed_65',
          finishMaterialId: 'ceramic_tile',
          pipeSpacingMm: 150,
        },
      },
    ],
    envelopeElements: [
      {
        kind: 'wall',
        roomId: 'r1',
        construction: 'наружная стена',
        presetId: 'wall_gas_concrete_d500',
        areaM2: 10.8,
        orientation: 'N',
      },
      {
        kind: 'window',
        roomId: 'r1',
        construction: 'окно',
        presetId: 'window_pvc_double_chamber_3_glass',
        areaM2: 2.5,
        orientation: 'N',
        openingWidthMm: 1500,
        openingHeightMm: 1400,
      },
      {
        kind: 'wall',
        roomId: 'r2',
        construction: 'наружная стена',
        presetId: 'wall_gas_concrete_d500',
        areaM2: 6.5,
        orientation: 'E',
      },
      {
        kind: 'window',
        roomId: 'r2',
        construction: 'окно',
        presetId: 'window_pvc_double_chamber_3_glass',
        areaM2: 2.0,
        orientation: 'E',
        openingWidthMm: 1200,
        openingHeightMm: 1200,
      },
    ],
  },
  heatingSystem: {
    supplyC: 75,
    returnC: 65,
    insideC: 20,
    thermalRegimePreset: 'traditional_dt50_75_65',
    waterUnderfloorHeating: true,
    ufhPresetId: 'ufh_mixed_radiators',
    hotWaterBoilerPowerMatchingScheme: 'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
  },
  hotWater: {
    residents: 2,
    coldWaterDesignSeason: 'winter',
    hotWaterC: 60,
    fixtures: { shower: 1, sink: 1, kitchenSink: 1 },
  },
  hydraulics: { mainLineLengthM: 8, deltaTSystemK: 20 },
});

const ufhRoomPartial = {
  enabled: true,
  basePresetId: 'ufh_base_interstory_screed_65',
  finishMaterialId: 'ceramic_tile',
  pipeSpacingMm: 150,
};

const apartmentEnvelopeWall = {
  kind: 'wall',
  construction: 'наружная стена',
  presetId: 'wall_gas_concrete_d500',
  areaM2: 8,
  orientation: 'N',
};

await runFixture('apartment_mixed_ufh_micro_branches', {
  building: {
    temps: { insideC: 20, outsideC: -22 },
    objectMeta: {
      objectType: 'apartment',
      apartmentStackPosition: 'middle',
      floors: 1,
      roomsCount: 5,
      ventilationReserveMode: 'natural',
      externalWalls: {
        presetId: 'wall_gas_concrete_d500',
        thicknessMm: 450,
        facadeSystem: 'sftk',
        insulationPresetId: 'insul_sftk_pps16f',
        insulationThicknessMm: 100,
      },
    },
    rooms: [
      { id: 'r1', name: 'Гостиная', type: 'living', floor: 1, topBoundary: 'heated', areaM2: 18, heightM: 2.7, roomExteriorLayout: 'facade', underfloorHeating: ufhRoomPartial },
      { id: 'r2', name: 'Спальня 1', type: 'living', floor: 1, topBoundary: 'heated', areaM2: 12, heightM: 2.7, roomExteriorLayout: 'facade', underfloorHeating: ufhRoomPartial },
      { id: 'r3', name: 'Спальня 2', type: 'living', floor: 1, topBoundary: 'heated', areaM2: 10, heightM: 2.7, roomExteriorLayout: 'internal', underfloorHeating: ufhRoomPartial },
      { id: 'r4', name: 'Детская', type: 'living', floor: 1, topBoundary: 'heated', areaM2: 9, heightM: 2.7, roomExteriorLayout: 'internal', underfloorHeating: ufhRoomPartial },
      { id: 'r5', name: 'Кухня', type: 'kitchen', floor: 1, topBoundary: 'heated', areaM2: 14, heightM: 2.7, roomExteriorLayout: 'facade' },
    ],
    envelopeElements: [
      { ...apartmentEnvelopeWall, roomId: 'r1', name: 'Стена r1', areaM2: 9 },
      { kind: 'window', roomId: 'r1', construction: 'окно', presetId: 'window_pvc_double_chamber_3_glass', areaM2: 2.5, orientation: 'N', openingWidthMm: 1500, openingHeightMm: 1400, name: 'Окно r1' },
      { ...apartmentEnvelopeWall, roomId: 'r2', name: 'Стена r2', areaM2: 7, orientation: 'E' },
      { kind: 'window', roomId: 'r2', construction: 'окно', presetId: 'window_pvc_double_chamber_3_glass', areaM2: 2, orientation: 'E', openingWidthMm: 1200, openingHeightMm: 1200, name: 'Окно r2' },
      { kind: 'wall', roomId: 'r3', name: 'Стена r3', construction: 'стена в неотапливаемый коридор', presetId: 'wall_gas_concrete_d500', areaM2: 6, orientation: 'S' },
      { kind: 'wall', roomId: 'r4', name: 'Стена r4', construction: 'стена в неотапливаемый коридор', presetId: 'wall_gas_concrete_d500', areaM2: 5.5, orientation: 'S' },
      { ...apartmentEnvelopeWall, roomId: 'r5', name: 'Стена r5', areaM2: 8, orientation: 'W' },
      { kind: 'window', roomId: 'r5', construction: 'окно', presetId: 'window_pvc_double_chamber_3_glass', areaM2: 2, orientation: 'W', openingWidthMm: 1200, openingHeightMm: 1200, name: 'Окно r5' },
    ],
  },
  heatingSystem: {
    hotWaterBoilerPowerMatchingScheme: 'combiBoilerWithBufferElectricStorage',
    thermalRegimePreset: 'condensing_dt30_55_45',
    waterUnderfloorHeating: true,
    ufhPresetId: 'ufh_mixed_radiators',
    underfloorDistributionPreset: 'auto',
    radiatorConnection: 'side',
  },
  hotWater: {
    residents: 4,
    coldWaterDesignSeason: 'winter',
    hotWaterC: 60,
    fixtures: { shower: 1, bath: 1, sink: 2, toilet: 1, kitchenSink: 1 },
    tropicalShower: true,
  },
  hydraulics: { mainLineLengthM: 6, deltaTSystemK: 20 },
});

await runFixture('apartment_mixed_ufh_mixing_valve', {
  building: {
    temps: { insideC: 20, outsideC: -22 },
    objectMeta: {
      objectType: 'apartment',
      apartmentStackPosition: 'middle_floor',
      floors: 1,
      roomsCount: 6,
      ventilationReserveMode: 'natural',
      externalWalls: {
        presetId: 'wall_gas_concrete_d500',
        thicknessMm: 450,
        facadeSystem: 'sftk',
        insulationPresetId: 'insul_sftk_pps16f',
        insulationThicknessMm: 40,
      },
      roofPresetId: 'roof_concrete_insulated_flat',
    },
    rooms: [
      { id: 'r1', name: 'Коридор', type: 'коридор', floor: 1, topBoundary: 'heated', bottomBoundary: 'heated', areaM2: 12, heightM: 2.75, roomExteriorLayout: 'internal' },
      { id: 'r2', name: 'Санузел', type: 'санузел', floor: 1, topBoundary: 'heated', bottomBoundary: 'heated', areaM2: 5, heightM: 2.75, roomExteriorLayout: 'internal' },
      { id: 'r3', name: 'Гостиная', type: 'гостиная', floor: 1, topBoundary: 'heated', bottomBoundary: 'heated', areaM2: 12, heightM: 2.75, roomExteriorLayout: 'facade', underfloorHeating: { enabled: true, basePresetId: 'ufh_base_interstory_screed_65', finishMaterialId: 'pvc_glue', pipeSpacingMm: 150, furnitureOccupiedAreaM2: 2 } },
      { id: 'r4', name: 'Кухня', type: 'кухня', floor: 1, topBoundary: 'heated', bottomBoundary: 'heated', areaM2: 12, heightM: 2.75, roomExteriorLayout: 'facade', underfloorHeating: { enabled: true, basePresetId: 'ufh_base_interstory_screed_65', finishMaterialId: 'pvc_glue', pipeSpacingMm: 150, furnitureOccupiedAreaM2: 6.5 } },
      { id: 'r5', name: 'Спальня 1', type: 'спальня', floor: 1, topBoundary: 'heated', bottomBoundary: 'heated', areaM2: 15, heightM: 2.75, roomExteriorLayout: 'facade' },
      { id: 'r6', name: 'Спальня 2', type: 'спальня', floor: 1, topBoundary: 'heated', bottomBoundary: 'heated', areaM2: 14, heightM: 2.75, roomExteriorLayout: 'corner' },
    ],
    envelopeElements: [
      { kind: 'wall', roomId: 'r1', name: 'Стена в коридор', construction: 'стена в неотапливаемый коридор', presetId: 'wall_gas_concrete_d500', areaM2: 12, orientation: 'SE' },
      { kind: 'wall', roomId: 'r3', name: 'Стена №1', construction: 'наружная стена', presetId: 'wall_gas_concrete_d500', areaM2: 5, orientation: 'NE' },
      { kind: 'window', roomId: 'r3', construction: 'окно', presetId: 'window_pvc_double_chamber_3_glass', areaM2: 7.41, orientation: 'NE', openingWidthMm: 3900, openingHeightMm: 1900, name: 'Окно r3' },
      { kind: 'wall', roomId: 'r4', name: 'Стена №1', construction: 'наружная стена', presetId: 'wall_gas_concrete_d500', areaM2: 6, orientation: 'NE' },
      { kind: 'window', roomId: 'r4', construction: 'окно', presetId: 'window_pvc_double_chamber_3_glass', areaM2: 3.24, orientation: 'NE', openingWidthMm: 1800, openingHeightMm: 1800, name: 'Окно r4' },
      { kind: 'wall', roomId: 'r5', name: 'Стена №1', construction: 'наружная стена', presetId: 'wall_gas_concrete_d500', areaM2: 6, orientation: 'NW' },
      { kind: 'window', roomId: 'r5', construction: 'окно', presetId: 'window_pvc_double_chamber_3_glass', areaM2: 3.24, orientation: 'NW', openingWidthMm: 1800, openingHeightMm: 1800, name: 'Окно r5' },
      { kind: 'wall', roomId: 'r6', name: 'Стена №1', construction: 'наружная стена', presetId: 'wall_gas_concrete_d500', areaM2: 12, orientation: 'NE' },
      { kind: 'wall', roomId: 'r6', name: 'Стена №2', construction: 'наружная стена', presetId: 'wall_gas_concrete_d500', areaM2: 4, orientation: 'NW' },
      { kind: 'window', roomId: 'r6', construction: 'окно', presetId: 'window_pvc_double_chamber_3_glass', areaM2: 3.42, orientation: 'NW', openingWidthMm: 1900, openingHeightMm: 1800, name: 'Окно r6' },
    ],
  },
  heatingSystem: {
    hotWaterBoilerPowerMatchingScheme: 'combiBoilerWithBufferElectricStorage',
    thermalRegimePreset: 'condensing_dt30_55_45',
    waterUnderfloorHeating: true,
    underfloorDistributionPreset: 'auto',
    ufhPresetId: 'ufh_mixed_radiators',
    heatingEmittersMode: 'mixed',
    supplyC: 55,
    returnC: 45,
    radiatorReferenceDeltaT: 50,
  },
  hotWater: {
    residents: 3,
    coldWaterDesignSeason: 'winter',
    hotWaterC: 60,
    fixtures: { shower: 1, sink: 1, toilet: 1, kitchenSink: 1, dishwasher: 1, washingMachine: 1, bidet: 1 },
  },
  hydraulics: { mainLineLengthM: 10, deltaTSystemK: 20 },
});

await runFixture('ufh_parasitic_down_resize', {
  building: {
    ...baseBuilding,
    rooms: [{
      ...baseBuilding.rooms[0],
      areaM2: 24,
      bottomBoundary: 'heated',
      underfloorHeating: {
        enabled: true,
        basePresetId: 'ufh_base_interstory_screed_65',
        finishMaterialId: 'ceramic_tile',
        pipeSpacingMm: 150,
      },
    }],
  },
  heatingSystem: {
    supplyC: 40,
    returnC: 30,
    insideC: 20,
    waterUnderfloorHeating: true,
    heatingEmittersMode: 'ufh_only',
    ufhPresetId: 'ufh_only',
  },
  hydraulics: { mainLineLengthM: 4 },
});

console.log('verify:hydraulics-pipeline — все фикстуры прошли');
