/**
 * Назначение: smoke-тест HydraulicsPipelineInput и pipeline.
 * Описание: buildSnapshots → validate → runHydraulicsPipeline на фикстурах calc.
 */

import { getReferenceBundle } from '../src/reference/public.js';
import { calculateHeatLossForBuilding } from '../src/logic/heatlossByRooms.js';
import { calculateUnderfloorHeating } from '../src/logic/warmFloorCalc.js';
import { calculateHotWaterDemand } from '../src/logic/hotWater.js';
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

console.log('verify:hydraulics-pipeline — все фикстуры прошли');
