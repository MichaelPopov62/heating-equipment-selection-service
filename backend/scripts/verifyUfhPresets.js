/**
 * Назначение: проверка справочника underfloor_heating_presets (v3).
 * Описание: Валидация JSON, обязательные presetId, derive supply/return (Δt=10 K), эталон technical.
 * Запуск: node scripts/verifyUfhPresets.js
 */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAndNormalizeUnderfloorHeatingPresets } from '../src/ufh/validateUnderfloorHeatingPresets.js';
import { computeUfhRoomHeatFlux } from '../src/logic/ufhRoomHeatFlux.js';
import { applyUnderfloorHeatingRecommendations } from '../src/matching/warmFloor.js';
import { warmupReferenceCache, getReferenceBundle } from '../src/reference/public.js';
import { toCalcRuntimeContext } from '../src/reference/toCalcRuntimeContext.js';
import { getFlooringFinishMaterialById } from '../src/data/flooringFinishMaterials.js';
import { getUnderfloorHeatingBasePresetById } from '../src/data/warmFloorAssemblyPresets.js';
import {
  UFH_MODE_PRESET_IDS,
  UFH_PRESET_MIXED_RADIATORS,
  UFH_PRESET_ONLY,
} from '../../shared/ufhModePresetIds.js';
import { assertAt, assertDefined } from './fixtures/scriptAssert.js';
import { buildObjectMeta, buildRoom, buildUfhReport, buildUfhRoom } from './fixtures/verifyFixtures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', 'data', 'underfloor_heating_presets.json');

const UFH_CIRCUIT_DELTA_T_K = 10;

/** @type {Record<string, { maxSupplyTemperatureC: number, maxSurfaceTemperatureC: number, hasMixingNode: boolean, requiresCondensingBoiler: boolean }>} */
const EXPECTED_TECHNICAL = {
  [UFH_PRESET_ONLY]: {
    maxSupplyTemperatureC: 40,
    maxSurfaceTemperatureC: 29,
    hasMixingNode: false,
    requiresCondensingBoiler: true,
  },
  [UFH_PRESET_MIXED_RADIATORS]: {
    maxSupplyTemperatureC: 45,
    maxSurfaceTemperatureC: 29,
    hasMixingNode: true,
    requiresCondensingBoiler: false,
  },
};

/** @param {boolean} ok @param {string} label */
function logCheck(ok, label) {
  console.log(ok ? 'OK' : 'FAIL', '—', label);
  return ok;
}

let failed = 0;

/** @param {boolean} ok */
function tally(ok) {
  if (!ok) failed += 1;
}

const raw = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
const bundle = validateAndNormalizeUnderfloorHeatingPresets(raw);

console.log('=== underfloor_heating_presets: validate + normalize ===');
tally(logCheck(bundle.schemaVersion >= 1, `schemaVersion = ${bundle.schemaVersion}`));
tally(
  logCheck(
    bundle.presets.length === UFH_MODE_PRESET_IDS.length,
    `количество пресетов = ${UFH_MODE_PRESET_IDS.length}`,
  ),
);

for (const id of UFH_MODE_PRESET_IDS) {
  const preset = bundle.byPresetId[id];
  const expected = EXPECTED_TECHNICAL[id];
  tally(logCheck(preset != null, `presetId "${id}" присутствует`));
  if (!preset || !expected) continue;

  const tech = preset.technical;
  tally(
    logCheck(
      tech.maxSupplyTemperatureC === expected.maxSupplyTemperatureC,
      `${id}: maxSupplyTemperatureC = ${expected.maxSupplyTemperatureC}`,
    ),
  );
  tally(
    logCheck(
      tech.maxSurfaceTemperatureC === expected.maxSurfaceTemperatureC,
      `${id}: maxSurfaceTemperatureC = ${expected.maxSurfaceTemperatureC}`,
    ),
  );
  tally(
    logCheck(
      tech.hasMixingNode === expected.hasMixingNode,
      `${id}: hasMixingNode = ${expected.hasMixingNode}`,
    ),
  );
  tally(
    logCheck(
      tech.requiresCondensingBoiler === expected.requiresCondensingBoiler,
      `${id}: requiresCondensingBoiler = ${expected.requiresCondensingBoiler}`,
    ),
  );
  tally(
    logCheck(
      tech.supplyC === tech.maxSupplyTemperatureC,
      `${id}: supplyC = maxSupplyTemperatureC`,
    ),
  );
  tally(
    logCheck(
      tech.returnC === tech.supplyC - UFH_CIRCUIT_DELTA_T_K,
      `${id}: returnC = supplyC − ${UFH_CIRCUIT_DELTA_T_K}`,
    ),
  );
  tally(
    logCheck(
      typeof preset.ui.title === 'string' && preset.ui.title.trim() !== '',
      `${id}: ui.title непустой`,
    ),
  );
}

console.log('\n=== maxSurface: min(пресет, финиш) в computeUfhRoomHeatFlux ===');
await warmupReferenceCache();
const calcCtx = toCalcRuntimeContext(await getReferenceBundle());
const base = getUnderfloorHeatingBasePresetById('ufh_base_interstory_screed_65');
const tile = getFlooringFinishMaterialById('ceramic_tile');
const laminate = getFlooringFinishMaterialById('laminate_click');

if (base && tile && laminate) {
  const tileFlux = computeUfhRoomHeatFlux({
    base,
    finish: tile,
    pipeSpacingMm: 150,
    circuitMeanC: 40,
    presetMaxSurfaceTemperatureC: 29,
    insideC: 20,
    outsideC: -5,
    bottomBoundary: 'unheated',
    areaM2: 10,
  });
  tally(
    logCheck(
      tileFlux.maxSurfaceTemperatureCelsius === 29,
      `плитка + preset 29 °C → applied max = 29 (не 35)`,
    ),
  );
  tally(
    logCheck(
      tileFlux.presetMaxSurfaceTemperatureCelsius === 29
      && tileFlux.finishMaxSurfaceTemperatureCelsius === 35,
      'плитка + preset 29 °C → поля preset/finish max в flux',
    ),
  );

  const tileReport = buildUfhReport({
    rooms: [
      buildUfhRoom('r1', 'Тест', 0, {
        finishMaterialId: 'ceramic_tile',
        finishMaterialName: tile.name,
        presetMaxSurfaceTemperatureCelsius: 29,
        finishMaxSurfaceTemperatureCelsius: 35,
        maxSurfaceTemperatureCelsius: 29,
        surfaceTempC: 25,
        heatFluxUpWm2: 50,
        maxAllowableHeatFluxUpWm2: 60,
        pipeSpacingMm: 150,
        circuitSupplyC: 45,
        circuitReturnC: 35,
        heatFluxUpWatts: 500,
        heatFluxDownWatts: 100,
      }),
    ],
  });
  applyUnderfloorHeatingRecommendations(tileReport, calcCtx.recommendations);
  const overrideRec = (tileReport.resolvedRecommendations ?? []).find(
    (/** @type {import('../src/recommendations/types.js').ResolvedRecommendation} */ r) =>
      r.code === 'WARN_UFH_SURFACE_TEMP_PRESET_OVERRIDE',
  );
  tally(
    logCheck(
      overrideRec != null,
      'плитка + preset 29 °C → WARN_UFH_SURFACE_TEMP_PRESET_OVERRIDE',
    ),
  );
  tally(
    logCheck(
      (overrideRec?.resolutionSteps?.length ?? 0) === 4
        && overrideRec?.resolutionSteps?.[0]?.title
          === 'Санитарно-комфортный лимит режима ТП',
      'WARN_UFH_SURFACE_TEMP_PRESET_OVERRIDE + 4 resolutionSteps',
    ),
  );

  const laminateFlux = computeUfhRoomHeatFlux({
    base,
    finish: laminate,
    pipeSpacingMm: 150,
    circuitMeanC: 35,
    presetMaxSurfaceTemperatureC: 27,
    insideC: 20,
    outsideC: -5,
    bottomBoundary: 'unheated',
    areaM2: 10,
  });
  tally(
    logCheck(
      laminateFlux.maxSurfaceTemperatureCelsius === 27,
      'ламинат + preset 27 °C → applied max = 27',
    ),
  );

  const pvcGlue = getFlooringFinishMaterialById('pvc_glue');
  if (pvcGlue) {
    const mixedPresetExpected = assertDefined(
      EXPECTED_TECHNICAL[UFH_PRESET_MIXED_RADIATORS],
      'EXPECTED_TECHNICAL mixed',
    );
    const pvcFlux = computeUfhRoomHeatFlux({
      base,
      finish: pvcGlue,
      pipeSpacingMm: 150,
      circuitMeanC: 35,
      presetMaxSurfaceTemperatureC: mixedPresetExpected.maxSurfaceTemperatureC,
      insideC: 20,
      outsideC: -5,
      bottomBoundary: 'heated',
      areaM2: 10,
    });
    tally(
      logCheck(
        pvcFlux.maxSurfaceTemperatureCelsius === 27,
        'ПВХ клей + preset 29 °C → applied max = 27 (паспорт финиша)',
      ),
    );
  }

  console.log('\n=== cap q↑ по лимиту поверхности (п.2) ===');
  const mixedCapExpected = assertDefined(
    EXPECTED_TECHNICAL[UFH_PRESET_MIXED_RADIATORS],
    'EXPECTED_TECHNICAL mixed cap',
  );
  const lamCapFlux = computeUfhRoomHeatFlux({
    base,
    finish: laminate,
    pipeSpacingMm: 100,
    circuitMeanC: 41,
    presetMaxSurfaceTemperatureC: mixedCapExpected.maxSurfaceTemperatureC,
    insideC: 20,
    outsideC: -5,
    bottomBoundary: 'heated',
    areaM2: 10,
  });
  tally(
    logCheck(
      lamCapFlux.heatFluxUpLimitedBySurface === true,
      'ламинат 46/36 + шаг 100 мм → q↑ ограничен лимитом 27 °C',
    ),
  );
  tally(
    logCheck(
      lamCapFlux.surfaceTempC <= lamCapFlux.maxSurfaceTemperatureCelsius + 0.05,
      `ламинат после cap: Tповерх ${lamCapFlux.surfaceTempC} ≤ ${lamCapFlux.maxSurfaceTemperatureCelsius} °C`,
    ),
  );
  tally(
    logCheck(
      lamCapFlux.heatFluxUpWm2 <= lamCapFlux.maxAllowableHeatFluxUpWm2 + 0.05,
      'ламинат после cap: heatFluxUpWm2 ≤ maxAllowableHeatFluxUpWm2',
    ),
  );
  tally(
    logCheck(
      lamCapFlux.roomWarnings.some((w) => w.includes('ограничена лимитом поверхности')),
      'ламинат cap → roomWarnings с текстом об ограничении',
    ),
  );

  const tileNormalFlux = computeUfhRoomHeatFlux({
    base,
    finish: tile,
    pipeSpacingMm: 150,
    circuitMeanC: 40,
    presetMaxSurfaceTemperatureC: 29,
    insideC: 20,
    outsideC: -5,
    bottomBoundary: 'heated',
    areaM2: 10,
  });
  tally(
    logCheck(
      tileNormalFlux.heatFluxUpLimitedBySurface !== true,
      'плитка 45/35 штатно → cap не требуется',
    ),
  );
  tally(
    logCheck(
      tileNormalFlux.surfaceTempC <= 29.05,
      `плитка штатно: Tповерх ${tileNormalFlux.surfaceTempC} ≤ 29 °C`,
    ),
  );

  console.log('\n=== базы ТП: XPS и паразитный поток вниз ===');
  const baseXps30 = getUnderfloorHeatingBasePresetById('ufh_base_interstory_screed_65');
  const baseXps100 = getUnderfloorHeatingBasePresetById('ufh_base_interstory_screed_65_xps100');
  tally(
    logCheck(
      baseXps30 != null && baseXps100 != null,
      'базы ufh_base_interstory_screed_65 и _xps100 присутствуют',
    ),
  );
  if (baseXps30 && baseXps100 && laminate) {
    /** @type {Omit<Parameters<typeof computeUfhRoomHeatFlux>[0], 'base' | 'pipeSpacingMm' | 'areaM2'>} */
    const fluxArgs = {
      finish: laminate,
      circuitMeanC: 35,
      presetMaxSurfaceTemperatureC: 27,
      insideC: 20,
      outsideC: -5,
      bottomBoundary: 'heated',
    };
    const down30 = computeUfhRoomHeatFlux({ ...fluxArgs, base: baseXps30, pipeSpacingMm: 150, areaM2: 12 });
    const down100 = computeUfhRoomHeatFlux({ ...fluxArgs, base: baseXps100, pipeSpacingMm: 150, areaM2: 12 });
    tally(
      logCheck(
        down100.heatFluxDownWm2 < down30.heatFluxDownWm2,
        `XPS 100 мм снижает q↓: ${down100.heatFluxDownWm2} < ${down30.heatFluxDownWm2} Вт/м²`,
      ),
    );
    tally(
      logCheck(
        down30.heatFluxUpWm2 === down100.heatFluxUpWm2,
        'толщина XPS не меняет q↑ (одинаковый rUp)',
      ),
    );
    if (down30.heatFluxDownWm2 > 5) {
      const parasiticReport = buildUfhReport({
        rooms: [
          buildUfhRoom('r_parasitic', 'Над отапливаемым', 0, {
            basePresetId: 'ufh_base_interstory_screed_65',
            finishMaterialId: 'laminate_click',
            finishMaterialName: 'Ламинат',
            roomAreaM2: 12,
            heatedAreaM2: 12,
            areaM2: 12,
            pipeSpacingMm: 150,
            requestedPipeSpacingMm: 150,
            resolvedPipeSpacingMm: 150,
            circuitSupplyC: 40,
            circuitReturnC: 30,
            circuitMeanC: down30.circuitMeanC,
            heatFluxUpWm2: down30.heatFluxUpWm2,
            heatFluxDownWm2: down30.heatFluxDownWm2,
            heatFluxUpWatts: down30.heatFluxUpWatts,
            heatFluxDownWatts: down30.heatFluxDownWatts,
            maxAllowableHeatFluxUpWm2: down30.maxAllowableHeatFluxUpWm2,
            surfaceTempC: down30.surfaceTempC,
            maxSurfaceTemperatureCelsius: down30.maxSurfaceTemperatureCelsius,
            bottomBoundary: 'heated',
            neighborTempC: down30.neighborTempC,
            coveringResistanceM2KW: down30.coveringResistanceM2KW,
            finishCoveringResistanceM2KW: down30.finishCoveringResistanceM2KW,
            pipeEmbedmentResistanceM2KW: down30.pipeEmbedmentResistanceM2KW,
            baseCoveringResistanceM2KW: down30.baseCoveringResistanceM2KW,
            resistanceUpM2KW: down30.resistanceUpM2KW,
            resistanceDownM2KW: down30.resistanceDownM2KW,
          }),
        ],
        totalHeatFluxUpWatts: down30.heatFluxUpWatts,
        totalHeatFluxDownWatts: down30.heatFluxDownWatts,
        circuitSupplyC: 40,
        circuitReturnC: 30,
        circuitMeanC: down30.circuitMeanC,
        circuitSource: 'finish_preset',
        isMixingNodeRequired: false,
      });
      applyUnderfloorHeatingRecommendations(parasiticReport, calcCtx.recommendations);
      const parasiticRec = (parasiticReport.resolvedRecommendations ?? []).find(
        (/** @type {import('../src/recommendations/types.js').ResolvedRecommendation} */ r) =>
          r.code === 'WARN_UFH_PARASITIC_DOWN_HEATED',
      );
      tally(
        logCheck(
          parasiticRec != null
            && (parasiticRec.resolutionSteps?.length ?? 0) === 4
            && parasiticRec.resolutionSteps?.[0]?.title === 'Увеличьте толщину утеплителя',
          'WARN_UFH_PARASITIC_DOWN_HEATED + 4 resolutionSteps',
        ),
      );
    } else {
      tally(logCheck(false, 'ожидался q↓ > 5 Вт/м² для WARN паразитного потока'));
    }
  }
  console.log('\n=== ufhLoopHydraulics: appliances + enrich ===');
  const hydRules = calcCtx.appliances.byKind.hydraulics;
  tally(
    logCheck(
      hydRules.ufhLoopPipeResizeEnabled === true,
      'appliances.hydraulics.ufhLoopPipeResizeEnabled = true',
    ),
  );
  tally(
    logCheck(
      hydRules.ufhParasiticDownTriggerWm2 === 5,
      'appliances.hydraulics.ufhParasiticDownTriggerWm2 = 5',
    ),
  );

  const { enrichUnderfloorHeatingLoopHydraulics, shouldTriggerUfhPipeResize } = await import(
    '../src/logic/ufhLoopHydraulics.js'
  );
  const { calculateUnderfloorHeating } = await import('../src/logic/warmFloorCalc.js');
  const { calculateHeatLossForBuilding } = await import('../src/logic/heatlossByRooms.js');

  /** @type {import('../src/types/shared-types.js').BuildingInput} */
  const ufhInputBuilding = {
    temps: { insideC: 20, outsideC: -5 },
    objectMeta: buildObjectMeta({ objectType: 'house', roomsCount: 1 }),
    rooms: [
      buildRoom({
        id: 'r_ufh',
        name: 'Гостиная',
        bottomBoundary: 'heated',
        areaM2: 20,
        underfloorHeating: {
          enabled: true,
          basePresetId: 'ufh_base_interstory_screed_65',
          finishMaterialId: 'ceramic_tile',
          pipeSpacingMm: 150,
        },
      }),
    ],
    envelopeElements: [{
      kind: 'wall',
      roomId: 'r_ufh',
      construction: 'наружная стена',
      presetId: 'wall_gas_concrete_d500',
      areaM2: 12,
      orientation: 'N',
    }],
  };

  const heatLoss = calculateHeatLossForBuilding({
    temps: { insideC: 20, outsideC: -5 },
    building: ufhInputBuilding,
  });
  const ufhReport = calculateUnderfloorHeating({
    temps: { insideC: 20, outsideC: -5 },
    building: ufhInputBuilding,
    heatingSystem: {
      supplyC: 40,
      returnC: 30,
      insideC: 20,
      waterUnderfloorHeating: true,
      heatingEmittersMode: 'ufh_only',
      ufhPresetId: 'ufh_only',
    },
    heatLoss,
    ufhPresets: calcCtx.ufhPresets,
    maxUfhLoopLengthM: hydRules.maxUfhLoopLengthM,
  });

  if (!ufhReport?.rooms?.[0]) {
    tally(logCheck(false, 'warmFloorCalc → комната с ТП'));
  } else {
    const ufhRoomCalc = assertAt(ufhReport.rooms, 0, 'ufhReport.rooms[0]');
    const trigger = shouldTriggerUfhPipeResize({
      heatFluxDownWm2: ufhRoomCalc.heatFluxDownWm2,
      heatFluxDownWatts: ufhRoomCalc.heatFluxDownWatts,
      heatFluxUpWatts: ufhRoomCalc.heatFluxUpWatts,
      bottomBoundary: ufhRoomCalc.bottomBoundary,
      hydraulicsRules: hydRules,
    });
    tally(
      logCheck(
        trigger === (ufhRoomCalc.bottomBoundary === 'heated' && ufhRoomCalc.heatFluxDownWm2 >= 5),
        `shouldTriggerUfhPipeResize для heated + q↓=${ufhRoomCalc.heatFluxDownWm2?.toFixed(1)}`,
      ),
    );

    enrichUnderfloorHeatingLoopHydraulics(ufhReport, {
      catalog: calcCtx.catalog,
      hydraulicsRules: hydRules,
    });

    const enriched = assertAt(ufhReport.rooms, 0, 'enriched ufhReport.rooms[0]');
    tally(
      logCheck(
        (enriched.loops?.length ?? 0) > 0,
        `enrich → loopsCount=${enriched.loopsCount}, loops=${enriched.loops?.length}`,
      ),
    );
    const loopHyd = assertAt(enriched.loops ?? [], 0, 'enriched.loops[0]').hydraulics;
    tally(
      logCheck(
        loopHyd?.catalogPipeId != null && loopHyd.velocityMps != null,
        `enrich → loop hydraulics v=${loopHyd?.velocityMps}, pipe=${loopHyd?.catalogPipeId}`,
      ),
    );
    tally(
      logCheck(
        loopHyd?.initialCatalogPipeId != null,
        'enrich → initialCatalogPipeId задан',
      ),
    );
  }
} else {
  tally(logCheck(false, 'база ТП или финиши для smoke-теста maxSurface'));
}

console.log('\n=== ufh_only: график котла 40/30 (не 75/65) ===');
{
  const { validateAndNormalizeInput } = await import('../src/api/validate.js');
  const { isHighTemperatureHeatingGraph } = await import(
    '../src/logic/heatingThermalRegimes.js'
  );
  const { calculateUnderfloorHeating } = await import('../src/logic/warmFloorCalc.js');
  const { calculateHeatLossForBuilding } = await import('../src/logic/heatlossByRooms.js');

  /** @type {import('../src/types/shared-types.js').CalcRequestBody} */
  const ufhOnlyBody = {
    building: {
      temps: { insideC: 20, outsideC: -5 },
      objectMeta: buildObjectMeta({ objectType: 'house', roomsCount: 1 }),
      rooms: [
        buildRoom({
          id: 'r1',
          name: 'Комната',
          bottomBoundary: 'heated',
          areaM2: 16,
          underfloorHeating: {
            enabled: true,
            basePresetId: 'ufh_base_interstory_screed_65',
            finishMaterialId: 'laminate_click',
            pipeSpacingMm: 150,
          },
        }),
      ],
      envelopeElements: [
        {
          kind: 'wall',
          roomId: 'r1',
          construction: 'наружная стена',
          presetId: 'wall_gas_concrete_d500',
          areaM2: 12,
          orientation: 'N',
        },
      ],
    },
    heatingSystem: {
      thermalRegimePreset: 'traditional_dt50_75_65',
      ufhPresetId: 'ufh_only',
      waterUnderfloorHeating: true,
      hotWaterBoilerPowerMatchingScheme:
        'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
    },
  };

  const normalized = validateAndNormalizeInput(ufhOnlyBody, calcCtx);
  const hs = normalized.heatingSystem;
  tally(
    logCheck(
      hs?.supplyC === 40 && hs?.returnC === 30,
      `ufh_only + traditional preset → supply/return ${hs?.supplyC}/${hs?.returnC} (ожид. 40/30)`,
    ),
  );
  tally(
    logCheck(
      hs?.thermalRegimePreset === 'condensing_dt30_55_45',
      `thermalRegimePreset согласован: ${hs?.thermalRegimePreset} (не traditional 75/65)`,
    ),
  );
  tally(
    logCheck(
      hs?.heatingEmittersMode === 'ufh_only',
      `heatingEmittersMode=${hs?.heatingEmittersMode}`,
    ),
  );
  tally(
    logCheck(
      isHighTemperatureHeatingGraph(hs) === false,
      'isHighTemperatureHeatingGraph(40/30) === false',
    ),
  );

  const heatLossNorm = calculateHeatLossForBuilding({
    temps: { insideC: 20, outsideC: -5 },
    building: normalized.building,
  });
  const ufhOnlyReport = calculateUnderfloorHeating({
    temps: { insideC: 20, outsideC: -5 },
    building: normalized.building,
    heatingSystem: hs,
    heatLoss: heatLossNorm,
    ufhPresets: calcCtx.ufhPresets,
  });
  tally(
    logCheck(
      ufhOnlyReport?.isMixingNodeRequired === false,
      'isMixingNodeRequired === false (прямое подключение)',
    ),
  );
  tally(
    logCheck(
      ufhOnlyReport?.circuitSupplyC === 40 && ufhOnlyReport?.circuitReturnC === 30,
      `контур ТП ${ufhOnlyReport?.circuitSupplyC}/${ufhOnlyReport?.circuitReturnC}`,
    ),
  );
  const mixWarn = (ufhOnlyReport?.warnings ?? []).find((w) =>
    w.includes('прямое подключение'),
  );
  const falseHighTempWarn = (ufhOnlyReport?.warnings ?? []).find(
    (w) => w.includes('не выше подачи контура') && w.includes('75'),
  );
  tally(
    logCheck(mixWarn != null, 'warning: прямое подключение (не ложный 75 °C)'),
  );
  tally(
    logCheck(falseHighTempWarn == null, 'нет ложного warning про котёл 75 °C'),
  );

  const { pickRadiatorsWithProposalLines } = await import(
    '../src/matching/radiators.js'
  );
  const radSkip = pickRadiatorsWithProposalLines({
    roomsHeatLoss: heatLossNorm,
    heatingSystem: hs,
    catalog: calcCtx.catalog,
    building: normalized.building,
    boiler: {
      requiredKw: 10,
      selected: null,
      proposal: null,
      proposalEconomy: null,
      proposalEfficient: null,
      warnings: [],
      heatLossKw: 10,
      reserveFactor: 1.15,
      hotWaterPowerKw: 0,
      heatingLoadKw: 11.5,
      hotWaterBoilerPowerMatchingScheme:
        'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
      condensingHeatingReserveFactor: 1.1,
      heatingLoadKwCondensing: 11,
      requiredKwForCondensingLine: 11,
      recommendations: [],
    },
    underfloorHeating: ufhOnlyReport,
    recommendations: calcCtx.recommendations,
  });
  tally(
    logCheck(
      radSkip.skippedReason === 'ufh_only',
      `skippedReason=${radSkip.skippedReason}`,
    ),
  );
  tally(
    logCheck(
      radSkip.byRoom.length === 0 && radSkip.totalSections == null,
      'radiators skip: byRoom пуст, totalSections null',
    ),
  );
  tally(
    logCheck(
      radSkip.lineEconomy?.unavailableReason != null
        && radSkip.lineEfficient?.unavailableReason != null,
      'lineEconomy/lineEfficient с unavailableReason',
    ),
  );
}

console.log(failed === 0 ? '\nverifyUfhPresets: ALL OK' : `\nverifyUfhPresets: ${failed} FAIL`);
process.exitCode = failed === 0 ? 0 : 1;
