/**
 * Назначение: проверка лимитов размера calcInput и BSON документа calculations.
 * Запуск: cd backend && npm run verify:document-size-limits
 */
import { Types } from 'mongoose';
import {
  MAX_CALC_INPUT_JSON_CHARS,
  MAX_CALCULATION_DOC_BSON_BYTES,
  assertCalcInputJsonSize,
  assertCalculationDocumentSize,
  estimateCalculationDocBsonBytes,
  isMongoBsonObjectTooLargeError,
} from '../src/projects/documentSizeLimits.js';

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
    const code = /** @type {{ code?: string, statusCode?: number }} */ (err).code;
    const statusCode = /** @type {{ statusCode?: number }} */ (err).statusCode;
    tally(
      logCheck(
        code === expectedCode && statusCode === 413,
        label,
      ),
    );
  }
}

/** @returns {import('../src/types/shared-types.js').CalcRequestBody} */
function tinyCalcInput() {
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

console.log('=== documentSizeLimits ===');

assertCalcInputJsonSize(tinyCalcInput());
tally(logCheck(true, 'маленький calcInput проходит'));

const padLen = MAX_CALC_INPUT_JSON_CHARS + 1;
const hugeCalcInput = {
  building: {
    ...tinyCalcInput().building,
    rooms: [{
      id: 'r1',
      name: 'x'.repeat(padLen),
      type: 'гостиная',
      floor: 1,
      topBoundary: 'heated',
      areaM2: 10,
      heightM: 2.7,
      bottomBoundary: 'unheated',
    }],
  },
};
assertThrowsCode(
  () => assertCalcInputJsonSize(hugeCalcInput),
  'CALC_INPUT_TOO_LARGE',
  'calcInput > MAX_CALC_INPUT_JSON_CHARS → CALC_INPUT_TOO_LARGE',
);

const projectId = new Types.ObjectId();
const smallDoc = {
  projectId,
  calcInput: tinyCalcInput(),
  report: { meta: { schemaVersion: 1 }, input: tinyCalcInput(), warnings: [] },
  summary: { heatLossKw: 5, warningsCount: 0 },
};
const smallBytes = assertCalculationDocumentSize(smallDoc);
tally(
  logCheck(
    smallBytes > 0 && smallBytes < MAX_CALCULATION_DOC_BSON_BYTES,
    'маленький документ calculations проходит assertCalculationDocumentSize',
  ),
);
tally(
  logCheck(
    estimateCalculationDocBsonBytes(smallDoc) === smallBytes,
    'estimateCalculationDocBsonBytes совпадает с assert',
  ),
);

const hugeReport = {
  meta: { schemaVersion: 1 },
  input: tinyCalcInput(),
  blob: 'z'.repeat(MAX_CALCULATION_DOC_BSON_BYTES),
};
assertThrowsCode(
  () =>
    assertCalculationDocumentSize({
      projectId,
      calcInput: tinyCalcInput(),
      report: hugeReport,
      summary: { warningsCount: 0 },
    }),
  'CALCULATION_DOCUMENT_TOO_LARGE',
  'report > MAX_CALCULATION_DOC_BSON_BYTES → CALCULATION_DOCUMENT_TOO_LARGE',
);

tally(
  logCheck(
    isMongoBsonObjectTooLargeError({ code: 10334, message: 'BSONObjectTooLarge' }),
    'isMongoBsonObjectTooLargeError: code 10334',
  ),
);
tally(
  logCheck(
    !isMongoBsonObjectTooLargeError(new Error('other')),
    'isMongoBsonObjectTooLargeError: обычная ошибка → false',
  ),
);

console.log(
  failed === 0
    ? '\nverifyDocumentSizeLimits: ALL OK'
    : `\nFAILED: ${failed}`,
);
process.exitCode = failed > 0 ? 1 : 0;
