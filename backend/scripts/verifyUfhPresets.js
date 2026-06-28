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
  UFH_PRESET_DIRECT_LAMINATE,
  UFH_PRESET_DIRECT_TILE,
  UFH_PRESET_MIXED_RADIATORS,
  UFH_PRESET_ONLY,
} from '../../shared/ufhModePresetIds.js';
import { collectUfhModeCircuitAlignmentIssues } from '../src/logic/ufhModeFinishCompatibility.js';

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
  [UFH_PRESET_DIRECT_TILE]: {
    maxSupplyTemperatureC: 45,
    maxSurfaceTemperatureC: 29,
    hasMixingNode: false,
    requiresCondensingBoiler: false,
  },
  [UFH_PRESET_DIRECT_LAMINATE]: {
    maxSupplyTemperatureC: 40,
    maxSurfaceTemperatureC: 27,
    hasMixingNode: false,
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

console.log('\n=== согласованность mode preset ↔ shared/ufhCircuitPresets ===');
const circuitAlignmentIssues = collectUfhModeCircuitAlignmentIssues(bundle);
for (const issue of circuitAlignmentIssues) {
  tally(logCheck(false, issue));
}
if (circuitAlignmentIssues.length === 0) {
  tally(logCheck(true, 'ufh_direct_tile / ufh_direct_laminate ↔ ufh_dt10_45_35 / ufh_dt10_40_30'));
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
    circuitSupplyC: 45,
    circuitReturnC: 35,
    presetMaxSurfaceTemperatureC: EXPECTED_TECHNICAL[UFH_PRESET_DIRECT_TILE].maxSurfaceTemperatureC,
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

  const tileReport = {
    rooms: [{
      roomId: 'r1',
      roomName: 'Тест',
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
      warnings: [],
    }],
    warnings: [],
  };
  applyUnderfloorHeatingRecommendations(tileReport, calcCtx.recommendations);
  const hasOverrideRec = (tileReport.resolvedRecommendations ?? []).some(
    (r) => r.code === 'WARN_UFH_SURFACE_TEMP_PRESET_OVERRIDE',
  );
  tally(
    logCheck(
      hasOverrideRec,
      'плитка + preset 29 °C → WARN_UFH_SURFACE_TEMP_PRESET_OVERRIDE',
    ),
  );

  const laminateFlux = computeUfhRoomHeatFlux({
    base,
    finish: laminate,
    pipeSpacingMm: 150,
    circuitMeanC: 35,
    circuitSupplyC: 40,
    circuitReturnC: 30,
    presetMaxSurfaceTemperatureC:
      EXPECTED_TECHNICAL[UFH_PRESET_DIRECT_LAMINATE].maxSurfaceTemperatureC,
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
    const pvcFlux = computeUfhRoomHeatFlux({
      base,
      finish: pvcGlue,
      pipeSpacingMm: 150,
      circuitMeanC: 35,
      circuitSupplyC: 40,
      circuitReturnC: 30,
      presetMaxSurfaceTemperatureC:
        EXPECTED_TECHNICAL[UFH_PRESET_MIXED_RADIATORS].maxSurfaceTemperatureC,
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
  const lamCapFlux = computeUfhRoomHeatFlux({
    base,
    finish: laminate,
    pipeSpacingMm: 100,
    circuitMeanC: 41,
    circuitSupplyC: 46,
    circuitReturnC: 36,
    presetMaxSurfaceTemperatureC:
      EXPECTED_TECHNICAL[UFH_PRESET_MIXED_RADIATORS].maxSurfaceTemperatureC,
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
    circuitSupplyC: 45,
    circuitReturnC: 35,
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
    const fluxArgs = {
      finish: laminate,
      pipeSpacingMm: 150,
      circuitMeanC: 35,
      circuitSupplyC: 40,
      circuitReturnC: 30,
      presetMaxSurfaceTemperatureC: 27,
      insideC: 20,
      outsideC: -5,
      bottomBoundary: 'heated',
      areaM2: 12,
    };
    const down30 = computeUfhRoomHeatFlux({ ...fluxArgs, base: baseXps30 });
    const down100 = computeUfhRoomHeatFlux({ ...fluxArgs, base: baseXps100 });
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

  const ufhInputBuilding = {
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
      id: 'r_ufh',
      name: 'Гостиная',
      type: 'living',
      floor: 1,
      topBoundary: 'heated',
      bottomBoundary: 'heated',
      areaM2: 20,
      heightM: 2.7,
      underfloorHeating: {
        enabled: true,
        basePresetId: 'ufh_base_interstory_screed_65',
        finishMaterialId: 'ceramic_tile',
        pipeSpacingMm: 150,
      },
    }],
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
    const ufhRoom = ufhReport.rooms[0];
    const trigger = shouldTriggerUfhPipeResize({
      heatFluxDownWm2: ufhRoom.heatFluxDownWm2,
      heatFluxDownWatts: ufhRoom.heatFluxDownWatts,
      heatFluxUpWatts: ufhRoom.heatFluxUpWatts,
      bottomBoundary: ufhRoom.bottomBoundary,
      hydraulicsRules: hydRules,
    });
    tally(
      logCheck(
        trigger === (ufhRoom.bottomBoundary === 'heated' && ufhRoom.heatFluxDownWm2 >= 5),
        `shouldTriggerUfhPipeResize для heated + q↓=${ufhRoom.heatFluxDownWm2?.toFixed(1)}`,
      ),
    );

    enrichUnderfloorHeatingLoopHydraulics(ufhReport, {
      catalog: calcCtx.catalog,
      hydraulicsRules: hydRules,
    });

    const enriched = ufhReport.rooms[0];
    tally(
      logCheck(
        (enriched.loops?.length ?? 0) > 0,
        `enrich → loopsCount=${enriched.loopsCount}, loops=${enriched.loops?.length}`,
      ),
    );
    const loopHyd = enriched.loops?.[0]?.hydraulics;
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

console.log(failed === 0 ? '\nverifyUfhPresets: ALL OK' : `\nverifyUfhPresets: ${failed} FAIL`);
process.exitCode = failed === 0 ? 0 : 1;
