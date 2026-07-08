/**
 * Назначение: проверка strict-валидации CalcInput (room.type, coerceTypes).
 * Запуск: cd backend && npm run verify:calc-input-validation
 */
import { validateAndNormalizeInput } from '../src/api/validate.js';
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
 * @param {string} expectedCode
 * @param {string} label
 */
function assertThrowsCode(fn, expectedCode, label) {
  try {
    fn();
    tally(logCheck(false, label));
  } catch (err) {
    const code = /** @type {{ code?: string }} */ (err).code;
    tally(logCheck(code === expectedCode, label));
  }
}

/** @returns {import('../src/types/shared-types').CalcRequestBody} */
function minimalBody(roomsPatch) {
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
      rooms: [
        {
          id: 'r1',
          name: 'Комната',
          type: 'гостиная',
          floor: 1,
          topBoundary: 'heated',
          bottomBoundary: 'unheated',
          areaM2: 10,
          heightM: 2.7,
          ...(roomsPatch ?? {}),
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
        },
      ],
    },
  };
}

const ctx = await loadCalcRuntimeContextFromFiles();

console.log('=== room.type strict ===');

assertThrowsCode(
  () =>
    validateAndNormalizeInput(
      minimalBody({ type: 'офис' }),
      ctx,
    ),
  'ROOM_TYPE_INVALID',
  'неизвестный type «офис» → ROOM_TYPE_INVALID',
);

assertThrowsCode(
  () => validateAndNormalizeInput(minimalBody({ type: 'living' }), ctx),
  'ROOM_TYPE_INVALID',
  'legacy living больше не поддерживается → ROOM_TYPE_INVALID',
);

console.log('\n=== AJV coerceTypes: false ===');

assertThrowsCode(
  () =>
    validateAndNormalizeInput(
      {
        ...minimalBody(),
        building: {
          ...minimalBody().building,
          temps: { insideC: '20', outsideC: -5 },
        },
      },
      ctx,
    ),
  'VALIDATION_ERROR',
  'insideC строкой → VALIDATION_ERROR (без coerce)',
);

const ok = validateAndNormalizeInput(minimalBody(), ctx);
tally(logCheck(ok.building?.rooms?.[0]?.type === 'гостиная', 'канонический type → OK'));

console.log('\n=== UFH mode preset ===');

/**
 * @param {string} finishMaterialId
 * @param {string} ufhPresetId
 * @returns {import('../src/types/shared-types').CalcRequestBody}
 */
function ufhBody(finishMaterialId, ufhPresetId) {
  const body = minimalBody({
    underfloorHeating: {
      enabled: true,
      basePresetId: 'ufh_base_interstory_screed_65',
      finishMaterialId,
    },
  });
  body.heatingSystem = {
    waterUnderfloorHeating: true,
    ufhPresetId,
    thermalRegimePreset: 'condensing_dt30_55_45',
    supplyC: 55,
    returnC: 45,
    radiatorReferenceDeltaT: 50,
    radiatorConnection: 'side',
    hotWaterBoilerPowerMatchingScheme: 'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
  };
  return body;
}

const mixedOk = validateAndNormalizeInput(ufhBody('ceramic_tile', 'ufh_mixed_radiators'), ctx);
tally(
  logCheck(
    mixedOk.heatingSystem?.ufhPresetId === 'ufh_mixed_radiators'
      && mixedOk.heatingSystem?.heatingEmittersMode === 'mixed',
    'ufh_mixed_radiators + ceramic_tile → OK (mixed)',
  ),
);

assertThrowsCode(
  () => validateAndNormalizeInput(ufhBody('ceramic_tile', 'ufh_direct_tile'), ctx),
  'VALIDATION_ERROR',
  'удалённый ufh_direct_tile вне enum → VALIDATION_ERROR',
);

console.log(
  failed === 0
    ? '\nverifyCalcInputValidation: ALL OK'
    : `\nFAILED: ${failed}`,
);
process.exitCode = failed > 0 ? 1 : 0;
