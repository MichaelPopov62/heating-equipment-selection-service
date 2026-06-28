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
      (s) => s.segmentRole === 'ufh_loop',
    ) ?? [];
    if (label.includes('ufh') && ufhPipeSegments.length === 0) {
      throw new Error(`${label}: нет pipeSegments ufh_loop в proposal`);
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
