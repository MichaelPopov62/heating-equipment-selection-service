/**
 * Назначение: проверка strict-валидации CalcInput (room.type, coerceTypes).
 * Запуск: cd backend && npm run verify:calc-input-validation
 */
import { validateAndNormalizeInput } from '../src/api/validate.js';
import { loadCalcRuntimeContextFromFiles } from './fixtures/calcRuntimeContextFromFiles.js';
import { buildObjectMeta, buildRoom } from './fixtures/verifyFixtures.js';
import { assertDefined } from './fixtures/scriptAssert.js';

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
    const code = /** @type {import('./fixtures/scriptAssert.js').ErrorWithCode} */ (err).code;
    tally(logCheck(code === expectedCode, label));
  }
}

/** @param {Partial<import('../src/types/shared-types.js').RoomInput>} [roomsPatch] @returns {import('../src/types/shared-types.js').CalcRequestBody} */
function minimalBody(roomsPatch) {
  return /** @type {import('../src/types/shared-types.js').CalcRequestBody} */ ({
    building: {
      temps: { insideC: 20, outsideC: -5 },
      objectMeta: buildObjectMeta({ objectType: 'house' }),
      rooms: [
        buildRoom({
          id: 'r1',
          name: 'Комната',
          areaM2: 10,
          ...roomsPatch,
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
        },
      ],
    },
  });
}

const ctx = await loadCalcRuntimeContextFromFiles();

console.log('=== room.type strict ===');

assertThrowsCode(
  () =>
    validateAndNormalizeInput(
      minimalBody({
        type: /** @type {import('../src/types/shared-types.js').RoomType} */ (
          /** @type {unknown} */ ('офис')
        ),
      }),
      ctx,
    ),
  'ROOM_TYPE_INVALID',
  'неизвестный type «офис» → ROOM_TYPE_INVALID',
);

assertThrowsCode(
  () => validateAndNormalizeInput(
    minimalBody({
      type: /** @type {import('../src/types/shared-types.js').RoomType} */ (
        /** @type {unknown} */ ('living')
      ),
    }),
    ctx,
  ),
  'ROOM_TYPE_INVALID',
  'legacy living больше не поддерживается → ROOM_TYPE_INVALID',
);

console.log('\n=== room.type normalization (trim / case / synonym) ===');

{
  const trimmed = validateAndNormalizeInput(
    minimalBody({
      type: /** @type {import('../src/types/shared-types.js').RoomType} */ (
        /** @type {unknown} */ ('  гостиная  ')
      ),
    }),
    ctx,
  );
  const room = assertDefined(trimmed.building?.rooms?.[0], 'trimmed.rooms[0]');
  tally(logCheck(room.type === 'гостиная', 'trim spaces «  гостиная  » → гостиная'));
}

{
  const upper = validateAndNormalizeInput(
    minimalBody({
      type: /** @type {import('../src/types/shared-types.js').RoomType} */ (
        /** @type {unknown} */ ('ГОСТИНАЯ')
      ),
    }),
    ctx,
  );
  const room = assertDefined(upper.building?.rooms?.[0], 'upper.rooms[0]');
  tally(logCheck(room.type === 'гостиная', 'case «ГОСТИНАЯ» → гостиная'));
}

{
  const synonym = validateAndNormalizeInput(
    minimalBody({
      type: /** @type {import('../src/types/shared-types.js').RoomType} */ (
        /** @type {unknown} */ ('гостинная')
      ),
    }),
    ctx,
  );
  const room = assertDefined(synonym.building?.rooms?.[0], 'synonym.rooms[0]');
  tally(logCheck(room.type === 'гостиная', 'синоним «гостинная» → гостиная'));
}

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
const firstRoom = assertDefined(ok.building?.rooms?.[0], 'ok.building.rooms[0]');
tally(logCheck(firstRoom.type === 'гостиная', 'канонический type → OK'));

console.log('\n=== UFH mode preset ===');

/**
 * @param {string} finishMaterialId
 * @param {string} ufhPresetId
 * @returns {import('../src/types/shared-types.js').CalcRequestBody}
 */
function ufhBody(finishMaterialId, ufhPresetId) {
  const body = minimalBody({
    underfloorHeating: {
      enabled: true,
      basePresetId: 'ufh_base_interstory_screed_65',
      finishMaterialId,
    },
  });
  body.heatingSystem = /** @type {import('../src/types/shared-types.js').HeatingSystemInput} */ (
    /** @type {unknown} */ ({
      waterUnderfloorHeating: true,
      ufhPresetId,
      thermalRegimePreset: 'condensing_dt30_55_45',
      supplyC: 55,
      returnC: 45,
      radiatorReferenceDeltaT: 50,
      radiatorConnection: 'side',
      hotWaterBoilerPowerMatchingScheme: 'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
    })
  );
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
