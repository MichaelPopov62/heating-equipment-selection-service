/**
 * Назначение: verify Dev-импорта проектов (validate + strip, без MongoDB).
 * Запуск: cd backend && npm run verify:project-import
 */

import { validateProjectImportBody } from '../src/projects/validateProjectImportBody.js';
import { PROJECT_EXPORT_SCHEMA_VERSION } from '../src/projects/projectExportConstants.js';
import {
  isLegacySurveyDraftImport,
  normalizeLegacySurveyImport,
} from '../src/projects/normalizeLegacySurveyImport.js';
import {
  stripCalculationImportFields,
  stripMongoExportFields,
  stripSurveyProjectId,
} from '../src/projects/stripMongoExportFields.js';
import { sortCalculationsForImport } from '../src/projects/sortCalculationsForImport.js';

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

/** @returns {Record<string, unknown>} */
function sampleSurvey() {
  return {
    schemaVersion: 4,
    savedAt: '2026-08-03T12:00:00.000Z',
    clientName: 'Тест',
    currentStep: 1,
    objectMeta: { objectType: 'house', floors: 1, roomsCount: 1 },
    rooms: [{ id: 'r1', name: 'Кімната', type: 'гостиная', floor: 1, topBoundary: 'heated', areaM2: 10, heightM: 2.7 }],
    temps: { insideC: 20, outsideC: -5 },
    hotWaterForm: { residents: 2 },
    waterHeaterForm: {},
    waterUnderfloorHeating: false,
    underfloorDistributionPreset: 'single',
    thermalRegimePreset: 'traditional_dt50_75_65',
    radiatorConnection: 'side',
    radiatorEmitterPreference: 'auto',
  };
}

/** @returns {Record<string, unknown>} */
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
        name: 'Кімната',
        type: 'гостиная',
        floor: 1,
        topBoundary: 'heated',
        areaM2: 10,
        heightM: 2.7,
      }],
    },
  };
}

/** @returns {Record<string, unknown>} */
function sampleReport() {
  return {
    meta: { generatedAt: '2026-08-03T12:00:00.000Z', schemaVersion: 1 },
    input: sampleCalcInput(),
    calculations: {
      hotWater: { recommendedTankLiters: 150, objectType: 'house' },
      heatLoss: { totalWatts: 5000 },
    },
    matching: { boiler: { requiredKw: 12 } },
    warnings: [],
  };
}

console.log('=== project import (validate/strip) ===');

const stripped = /** @type {Record<string, unknown>} */ (
  stripMongoExportFields({
    _id: 'abc',
    ownerId: 'def',
    shareToken: 'tok',
    project: { clientName: 'A' },
  })
);
const strippedProject = /** @type {Record<string, unknown> | undefined} */ (stripped.project);
tally(
  logCheck(
    stripped._id === undefined
      && stripped.ownerId === undefined
      && stripped.shareToken === undefined
      && strippedProject?.clientName === 'A',
    'stripMongoExportFields удаляет служебные поля верхнего уровня',
  ),
);

const surveyStripped = stripSurveyProjectId({ ...sampleSurvey(), projectId: '507f1f77bcf86cd799439011' });
tally(
  logCheck(
    surveyStripped?.projectId === undefined && surveyStripped?.clientName === 'Тест',
    'stripSurveyProjectId удаляет projectId',
  ),
);

const calcStripped = stripCalculationImportFields({
  _id: '1',
  id: '507f1f77bcf86cd799439011',
  projectId: '507f1f77bcf86cd799439011',
  createdAt: '2026-01-01',
  calcInput: sampleCalcInput(),
  report: sampleReport(),
});
tally(
  logCheck(
    calcStripped.id === undefined
      && calcStripped.projectId === undefined
      && calcStripped.calcInput !== undefined,
    'stripCalculationImportFields удаляет id/projectId расчёта',
  ),
);

const bundle = validateProjectImportBody({
  exportSchemaVersion: PROJECT_EXPORT_SCHEMA_VERSION,
  exportedAt: '2026-08-03T12:00:00.000Z',
  source: { projectId: '507f1f77bcf86cd799439011' },
  project: {
    clientName: '  Клієнт  ',
    survey: { ...sampleSurvey(), projectId: 'old' },
    lastCalcInput: sampleCalcInput(),
  },
  calculations: [{
    id: 'calc-old',
    projectId: '507f1f77bcf86cd799439011',
    calcInput: sampleCalcInput(),
    report: sampleReport(),
    sourceCreatedAt: '2026-08-01T10:00:00.000Z',
  }],
});

tally(
  logCheck(
    bundle.clientName === 'Клієнт'
      && bundle.calculations.length === 1
      && bundle.sourceProjectId === '507f1f77bcf86cd799439011'
      && bundle.survey?.projectId === undefined,
    'validateProjectImportBody — bundle v1',
  ),
);

assertThrowsCode(
  () => validateProjectImportBody({ exportSchemaVersion: 99, project: { clientName: 'X' } }),
  'UNSUPPORTED_EXPORT_VERSION',
  'unsupported exportSchemaVersion → UNSUPPORTED_EXPORT_VERSION',
);

const legacyRaw = {
  ...sampleSurvey(),
  clientName: 'Legacy',
  lastCalcReport: sampleReport(),
  projectId: '507f1f77bcf86cd799439011',
};
tally(logCheck(isLegacySurveyDraftImport(legacyRaw), 'isLegacySurveyDraftImport распознаёт SurveyDraft'));

const legacy = normalizeLegacySurveyImport(legacyRaw);
tally(logCheck(legacy.calculations.length === 1, 'normalizeLegacySurveyImport добавляет calculation из lastCalcReport'));

const legacyPayload = validateProjectImportBody(legacyRaw);
tally(
  logCheck(
    legacyPayload.clientName === 'Legacy' && legacyPayload.calculations.length === 1,
    'validateProjectImportBody — legacy SurveyDraft',
  ),
);

assertThrowsCode(
  () => validateProjectImportBody(null),
  'VALIDATION_ERROR',
  'null body → VALIDATION_ERROR',
);

assertThrowsCode(
  () => validateProjectImportBody({
    exportSchemaVersion: PROJECT_EXPORT_SCHEMA_VERSION,
    project: { clientName: 'X' },
    calculations: [{ report: sampleReport() }],
  }),
  'VALIDATION_ERROR',
  'calculation без calcInput → VALIDATION_ERROR',
);

const sorted = sortCalculationsForImport([
  { calcInput: {}, report: {}, sourceCreatedAt: '2026-08-03T12:00:00.000Z' },
  { calcInput: {}, report: {}, sourceCreatedAt: '2026-08-01T10:00:00.000Z' },
]);
tally(
  logCheck(
    sorted[0]?.sourceCreatedAt === '2026-08-01T10:00:00.000Z',
    'sortCalculationsForImport — хронологический порядок',
  ),
);

if (failed > 0) {
  console.error(`\nverify:project-import — ${failed} failure(s)`);
  process.exit(1);
}

console.log('\nverify:project-import — all checks passed');
