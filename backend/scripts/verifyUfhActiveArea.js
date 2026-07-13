/**
 * Назначение: verify мебели на полу ТП (S_meb → S_акт, авто-шаг, рекомендации).
 * Запуск: npm run verify:ufh-active-area (из backend/)
 */

import { warmupReferenceCache, getReferenceBundle, toCalcRuntimeContext } from '../src/reference/public.js';
import { validateAndNormalizeInput } from '../src/api/validate.js';
import { buildReport } from '../src/report/public.js';
import { resolveUfhActiveFloorAreaM2 } from '../src/logic/ufhActiveFloorArea.js';

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

/** @type {import('../src/types/shared-types').CalcRequestBody} */
const baseBody = {
  building: {
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
    rooms: [
      {
        id: 'r1',
        name: 'Гостиная',
        type: 'гостиная',
        floor: 1,
        topBoundary: 'heated',
        bottomBoundary: 'heated',
        areaM2: 20,
        heightM: 2.7,
        roomExteriorLayout: 'facade',
        underfloorHeating: {
          enabled: true,
          basePresetId: 'ufh_base_interstory_screed_65',
          finishMaterialId: 'laminate_click',
          pipeSpacingMm: 200,
        },
      },
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
inputFurniture.building.rooms[0].underfloorHeating.furnitureOccupiedAreaM2 = 17;
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
  badInput.building.rooms[0].underfloorHeating.furnitureOccupiedAreaM2 = 20;
  await validateAndNormalizeInput(badInput, ctx);
} catch (err) {
  validationRejected =
    err instanceof Error
    && /** @type {{ code?: string }} */ (err).code === 'UNDERFLOOR_HEATING_FURNITURE_AREA_INVALID';
}
check(validationRejected, 'валидация: S_meb >= areaM2 → 400');

console.log(`\nИтого: ${passed} OK, ${failed} FAIL`);
if (failed > 0) process.exit(1);
