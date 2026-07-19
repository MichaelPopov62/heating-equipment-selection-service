/**
 * Назначение: verify мебели на полу ТП (S_meb → S_акт, авто-шаг, рекомендации).
 * Запуск: npm run verify:ufh-active-area (из backend/)
 */

import { warmupReferenceCache, getReferenceBundle, toCalcRuntimeContext } from '../src/reference/public.js';
import { validateAndNormalizeInput } from '../src/api/validate.js';
import { buildReport } from '../src/report/public.js';
import { resolveUfhActiveFloorAreaM2 } from '../src/logic/ufhActiveFloorArea.js';
import { applyUnderfloorHeatingRecommendations } from '../src/matching/warmFloor.js';
import { assertAt, assertDefined } from './fixtures/scriptAssert.js';
import { buildObjectMeta, buildRoom, buildUfhReport, buildUfhRoom } from './fixtures/verifyFixtures.js';

let passed = 0;
let failed = 0;

/**
 * @param {boolean} ok
 * @param {string} label
 */
function check(ok, label) {
  if (ok) {
    passed += 1;
    console.log(`OK ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

await warmupReferenceCache();
const ctx = toCalcRuntimeContext(await getReferenceBundle());

/** @type {import('../src/types/shared-types.js').CalcRequestBody} */
const baseBody = {
  building: {
    temps: { insideC: 20, outsideC: -5 },
    objectMeta: buildObjectMeta({ objectType: 'house', roomsCount: 1 }),
    rooms: [
      buildRoom({
        id: 'r1',
        name: 'Гостиная',
        bottomBoundary: 'heated',
        areaM2: 20,
        roomExteriorLayout: 'facade',
        underfloorHeating: {
          enabled: true,
          basePresetId: 'ufh_base_interstory_screed_65',
          finishMaterialId: 'laminate_click',
          pipeSpacingMm: 200,
        },
      }),
    ],
    envelopeElements: [
      {
        kind: 'wall',
        roomId: 'r1',
        name: 'Стена',
        construction: 'наружная стена',
        presetId: 'wall_gas_concrete_d500',
        areaM2: 12,
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
    ],
  },
  heatingSystem: {
    waterUnderfloorHeating: true,
    ufhPresetId: 'ufh_mixed_radiators',
    thermalRegimePreset: 'condensing_dt30_55_45',
    supplyC: 55,
    returnC: 45,
    radiatorReferenceDeltaT: 50,
    radiatorConnection: 'side',
  },
};

const areaUnit = resolveUfhActiveFloorAreaM2({
  roomAreaM2: 20,
  furnitureOccupiedAreaM2: 5,
});
check(areaUnit.heatedAreaM2 === 15, 'unit: heatedAreaM2 = 20 − 5');
check(areaUnit.status === 'ok', 'unit: status ok');

const inputNoFurniture = structuredClone(baseBody);
const normNoFurniture = await validateAndNormalizeInput(inputNoFurniture, ctx);
const reportNoFurniture = await buildReport({ input: normNoFurniture, ctx });
const roomNoFurniture = reportNoFurniture.calculations?.underfloorHeating?.rooms?.[0];
check(roomNoFurniture?.heatedAreaM2 === 20, 'без мебели: heatedAreaM2 = roomAreaM2');
check(roomNoFurniture?.furnitureOccupiedAreaM2 === 0, 'без мебели: furnitureOccupiedAreaM2 = 0');
check(
  roomNoFurniture?.pipeSpacingResolution === 'matched_requested',
  'без мебели: pipeSpacingResolution matched_requested',
);

const inputFurniture = structuredClone(baseBody);
const furnitureRoom = assertAt(inputFurniture.building.rooms, 0, 'building.rooms[0]');
furnitureRoom.underfloorHeating = {
  ...assertDefined(furnitureRoom.underfloorHeating, 'underfloorHeating'),
  furnitureOccupiedAreaM2: 17,
};
const normFurniture = await validateAndNormalizeInput(inputFurniture, ctx);
const reportFurniture = await buildReport({ input: normFurniture, ctx });
const roomFurniture = reportFurniture.calculations?.underfloorHeating?.rooms?.[0];

check(roomFurniture?.heatedAreaM2 === 3, 'с мебелью: heatedAreaM2 = 3');
check(roomFurniture?.furnitureOccupiedAreaM2 === 17, 'с мебелью: furnitureOccupiedAreaM2 = 17');
check(
  typeof roomFurniture?.requiredHeatFluxUpWm2 === 'number'
  && roomFurniture.requiredHeatFluxUpWm2 > 0,
  'с мебелью: requiredHeatFluxUpWm2 > 0',
);

const layoutFactor =
  typeof roomFurniture?.loopLengthLayoutFactor === 'number'
    ? roomFurniture.loopLengthLayoutFactor
    : 1.1;
const expectedLoopLen =
  roomFurniture != null
    ? (roomFurniture.heatedAreaM2 / (roomFurniture.resolvedPipeSpacingMm / 1000))
      * layoutFactor
    : 0;
const actualLoopLen = roomFurniture?.loops?.[0]?.loopLengthM ?? 0;
check(
  Math.abs(actualLoopLen - expectedLoopLen) < 0.2,
  `длина петли ТП ≈ S_акт/шаг×${layoutFactor} (${actualLoopLen} ≈ ${expectedLoopLen.toFixed(1)})`,
);
check(
  typeof roomFurniture?.pipeMetersPerSqM === 'number'
    && Math.abs(
      roomFurniture.pipeMetersPerSqM
        - layoutFactor / (roomFurniture.resolvedPipeSpacingMm / 1000),
    ) < 0.01,
  'pipeMetersPerSqM = layoutFactor / шаг',
);

check(
  roomFurniture?.activeAreaCheckStatus === 'insufficient_active_area',
  'большая мебель: activeAreaCheckStatus insufficient_active_area',
);

const resolvedRecs =
  reportFurniture.calculations?.underfloorHeating?.resolvedRecommendations ?? [];
const hasActiveAreaWarn =
  resolvedRecs.some((r) => r.code === 'WARN_UFH_ACTIVE_AREA_INSUFFICIENT')
  || (roomFurniture?.warnings ?? []).some((w) => w.includes('Активной площади ТП недостаточно'));
check(hasActiveAreaWarn, 'большая мебель: WARN_UFH_ACTIVE_AREA_INSUFFICIENT');

check(
  roomFurniture?.resolvedPipeSpacingMm === 100
  || roomFurniture?.pipeSpacingResolution === 'tightened',
  'большая мебель: авто-шаг ужесточён',
);

let validationRejected = false;
try {
  const badInput = structuredClone(baseBody);
  const badRoom = assertAt(badInput.building.rooms, 0, 'building.rooms[0]');
  badRoom.underfloorHeating = {
    ...assertDefined(badRoom.underfloorHeating, 'underfloorHeating'),
    furnitureOccupiedAreaM2: 20,
  };
  await validateAndNormalizeInput(badInput, ctx);
} catch (err) {
  validationRejected =
    err instanceof Error
    && /** @type {{ code?: string }} */ (err).code === 'UNDERFLOOR_HEATING_FURNITURE_AREA_INVALID';
}
check(validationRejected, 'валидация: S_meb >= areaM2 → 400');

const coverageCatalog = ctx.recommendations.byCode.WARN_UFH_COVERAGE_LOW;
check(coverageCatalog != null, 'справочник: WARN_UFH_COVERAGE_LOW присутствует');
check(
  (coverageCatalog?.resolutionSteps?.length ?? 0) === 4
    && coverageCatalog?.resolutionSteps?.[0]?.title === 'Добавьте радиатор или конвектор',
  'WARN_UFH_COVERAGE_LOW: 4 resolutionSteps, первый — «Добавьте радиатор или конвектор»',
);

const coverageReport = buildUfhReport({
  rooms: [
    buildUfhRoom('r_cov', 'Комната 1', 1, {
      heatFluxUpWatts: 1707.4,
      roomHeatLossWatts: 2347.9754161118362,
      heatFluxCoverageRatio: 0.727,
      heatFluxCoverageStatus: 'low',
      heatedAreaM2: 12,
      roomAreaM2: 12,
      pipeSpacingMm: 150,
    }),
    buildUfhRoom('r_cov2', 'Комната 2', 1, {
      heatFluxUpWatts: 948.2,
      roomHeatLossWatts: 1369.062776089469,
      heatFluxCoverageRatio: 0.693,
      heatFluxCoverageStatus: 'low',
      heatedAreaM2: 8,
      roomAreaM2: 8,
      pipeSpacingMm: 150,
    }),
  ],
  totalHeatFluxUpWatts: 2655.6,
  totalHeatFluxDownWatts: 0,
  circuitSupplyC: 40,
  circuitReturnC: 30,
  circuitMeanC: 35,
  circuitSource: 'finish_preset',
  isMixingNodeRequired: false,
});
applyUnderfloorHeatingRecommendations(coverageReport, ctx.recommendations);
const coverageRecs = (coverageReport.resolvedRecommendations ?? []).filter(
  (r) => r.code === 'WARN_UFH_COVERAGE_LOW',
);
check(coverageRecs.length === 2, 'coverage low: 2× WARN_UFH_COVERAGE_LOW (по комнатам)');
check(
  coverageRecs.every((r) => (r.resolutionSteps?.length ?? 0) === 4),
  'coverage low: resolutionSteps прокинуты в resolvedRecommendations',
);
check(
  coverageRecs[0]?.text.includes('≈1707 Вт') === true
    && coverageRecs[0]?.text.includes('≈2348 Вт') === true
    && !coverageRecs[0]?.text.includes('2347.975'),
  'coverage low: мощность в тексте WARN округлена до целых Вт',
);
check(
  coverageRecs[1]?.text.includes('≈948 Вт') === true
    && coverageRecs[1]?.text.includes('≈1369 Вт') === true,
  'coverage low: Комната 2 — округлённые Вт в тексте',
);

console.log(`\nИтого: ${passed} OK, ${failed} FAIL`);
if (failed > 0) process.exit(1);
