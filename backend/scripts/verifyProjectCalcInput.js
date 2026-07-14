/**
 * Назначение: проверка resolveProjectCalcInput (fallback lastCalcInput).
 * Запуск: cd backend && npm run verify:project-calc-input
 */
import { resolveProjectCalcInput } from '../src/projects/resolveProjectCalcInput.js';
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

/** @returns {import('../src/types/shared-types.js').CalcRequestBody} */
function sampleCalcInput() {
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
        type: 'гостиная',
        floor: 1,
        topBoundary: 'heated',
        areaM2: 10,
        heightM: 2.7,
        bottomBoundary: 'unheated',
      }],
      envelopeElements: [{
        kind: 'wall',
        roomId: 'r1',
        construction: 'наружная стена',
        presetId: 'wall_gas_concrete_d500',
        areaM2: 12,
      }],
    },
  };
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

const calc = sampleCalcInput();
const last = sampleCalcInput();
const lastTemps = assertDefined(last.building.temps, 'last.building.temps');
lastTemps.outsideC = -10;

console.log('=== resolveProjectCalcInput ===');

const fromWrapper = resolveProjectCalcInput({ calcInput: calc, survey: { x: 1 } }, null);
tally(
  logCheck(
    fromWrapper.source === 'calcInput'
      && fromWrapper.payload.building?.temps?.outsideC === -5,
    'calcInput + survey → calcInput',
  ),
);

const fromBody = resolveProjectCalcInput({ ...calc, survey: { draft: true } }, null);
const bodyPayload = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (fromBody.payload));
tally(
  logCheck(
    fromBody.source === 'body'
      && bodyPayload.survey === undefined
      && fromBody.payload.building?.temps?.outsideC === -5,
    'корневой CalcInput + survey → body без survey',
  ),
);

const fromLastEmpty = resolveProjectCalcInput({}, last);
tally(
  logCheck(
    fromLastEmpty.source === 'lastCalcInput'
      && fromLastEmpty.payload.building?.temps?.outsideC === -10,
    '{} + lastCalcInput → lastCalcInput',
  ),
);

const fromLastSurvey = resolveProjectCalcInput({ survey: { step: 2 } }, last);
tally(
  logCheck(
    fromLastSurvey.source === 'lastCalcInput'
      && fromLastSurvey.payload.building?.temps?.outsideC === -10,
    '{ survey } + lastCalcInput → lastCalcInput',
  ),
);

assertThrowsCode(
  () => resolveProjectCalcInput({}, null),
  'CALC_INPUT_REQUIRED',
  '{} без lastCalcInput → CALC_INPUT_REQUIRED',
);

assertThrowsCode(
  () => resolveProjectCalcInput({ survey: { only: true } }, null),
  'CALC_INPUT_REQUIRED',
  '{ survey } без lastCalcInput → CALC_INPUT_REQUIRED',
);

assertThrowsCode(
  () => resolveProjectCalcInput({ calcInput: { location: { address: 'x' } } }, null),
  'CALC_INPUT_REQUIRED',
  'calcInput без building → CALC_INPUT_REQUIRED',
);

console.log(
  failed === 0
    ? '\nverifyProjectCalcInput: ALL OK'
    : `\nFAILED: ${failed}`,
);
process.exitCode = failed > 0 ? 1 : 0;
