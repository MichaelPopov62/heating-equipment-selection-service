/**
 * Назначение: проверка контракта CalcRuntimeContext (явные справочники, без legacy sync-кэша).
 * Описание: fail-fast без ctx; file-fixture без Mongo; warmFloorCalc с неизвестным ufhPresetId.
 * Запуск: cd backend && npm run verify:calc-runtime-context
 */
import { validateAndNormalizeInput } from '../src/api/validate.js';
import { calculateUnderfloorHeating } from '../src/logic/warmFloorCalc.js';
import { loadCalcRuntimeContextFromFiles } from './fixtures/calcRuntimeContextFromFiles.js';

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

/**
 * @param {() => void} fn
 * @param {string | RegExp} expectedMessage
 * @param {string} label
 */
function assertThrows(fn, expectedMessage, label) {
  try {
    fn();
    tally(logCheck(false, label));
    return;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const ok =
      typeof expectedMessage === 'string'
        ? msg.includes(expectedMessage)
        : expectedMessage.test(msg);
    tally(logCheck(ok, label));
  }
}

/** @returns {import('../src/types/shared-types').CalcRequestBody} */
function minimalCalcBody() {
  return {
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
      rooms: [{
        id: 'r1',
        name: 'Комната',
        type: 'living',
        floor: 1,
        topBoundary: 'heated',
        areaM2: 10,
        heightM: 2.7,
        bottomBoundary: 'unheated',
      }],
      envelopeElements: [{
        kind: 'wall',
        roomId: 'r1',
        name: 'Стена №1',
        construction: 'наружная стена',
        presetId: 'wall_gas_concrete_d500',
        areaM2: 12,
        orientation: 'N',
      }],
    },
  };
}

console.log('=== CalcRuntimeContext: fail-fast без ctx ===');

assertThrows(
  () => validateAndNormalizeInput(minimalCalcBody()),
  'CalcRuntimeContext отсутствует',
  'validateAndNormalizeInput без ctx → assertCalcRuntimeContext',
);

assertThrows(
  () =>
    calculateUnderfloorHeating({
      temps: { insideC: 20, outsideC: -5 },
      building: minimalCalcBody().building,
      heatingSystem: { ufhPresetId: 'ufh_only', waterUnderfloorHeating: true },
      heatLoss: null,
    }),
  'ufhPresets обязательны',
  'calculateUnderfloorHeating без ufhPresets → throw',
);

console.log('\n=== CalcRuntimeContext: file-fixture (без Mongo) ===');

const ctx = await loadCalcRuntimeContextFromFiles();

tally(
  logCheck(
    ctx.appliances?.byKind?.boiler != null && ctx.ufhPresets?.byPresetId != null,
    'loadCalcRuntimeContextFromFiles: appliances + ufhPresets',
  ),
);

const normalized = validateAndNormalizeInput(minimalCalcBody(), ctx);
tally(
  logCheck(
    normalized.building?.temps?.insideC === 20,
    'validateAndNormalizeInput(body, ctx) — успешная нормализация',
  ),
);

console.log('\n=== warmFloorCalc: неизвестный ufhPresetId ===');

assertThrows(
  () =>
    calculateUnderfloorHeating({
      temps: { insideC: 20, outsideC: -5 },
      building: minimalCalcBody().building,
      heatingSystem: {
        ufhPresetId: 'unknown_preset_xyz',
        waterUnderfloorHeating: true,
        supplyC: 55,
        returnC: 45,
      },
      heatLoss: null,
      ufhPresets: ctx.ufhPresets,
    }),
  'Неизвестный ufhPresetId',
  'calculateUnderfloorHeating: неизвестный preset → throw (не silent null)',
);

console.log(
  failed === 0
    ? '\nverifyCalcRuntimeContext: ALL OK'
    : `\nFAILED: ${failed}`,
);
process.exitCode = failed > 0 ? 1 : 0;
