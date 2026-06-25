/**
 * Назначение: Smoke-тест нормализации snapshot черновика анкеты.
 * Описание: Запуск: npm run verify:survey-draft-migration (из backend/)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  HOT_WATER_BOILER_MATCHING_SCHEME_ENUM,
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
} from '../../shared/heatingMatchingSchemes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const surveyDraftTs = fs.readFileSync(
  path.join(__dirname, '../../frontend/src/types/surveyDraft.ts'),
  'utf8',
);
const schemaMatch = surveyDraftTs.match(/SURVEY_DRAFT_SCHEMA_VERSION = (\d+)/);
if (!schemaMatch) {
  console.error('FAIL: не найден SURVEY_DRAFT_SCHEMA_VERSION в surveyDraft.ts');
  process.exit(1);
}
const SURVEY_DRAFT_SCHEMA_VERSION = Number(schemaMatch[1]);

let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    failed += 1;
  } else {
    console.log('OK:', msg);
  }
}

const SCHEME_SET = new Set(HOT_WATER_BOILER_MATCHING_SCHEME_ENUM);

/**
 * @param {unknown} raw
 * @returns {import('../../frontend/src/types/waterHeater.ts').WaterHeaterFormValue}
 */
function normalizeWaterHeaterForm(raw) {
  const defaults = {
    hotWaterBoilerPowerMatchingScheme: SCHEME_BOILER_MAX_COMBI,
    indirectDhwSpaceAvailable: false,
  };
  if (typeof raw !== 'object' || raw === null) return defaults;
  const rec = /** @type {Record<string, unknown>} */ (raw);
  const schemeRaw = rec.hotWaterBoilerPowerMatchingScheme;
  return {
    hotWaterBoilerPowerMatchingScheme:
      typeof schemeRaw === 'string' && SCHEME_SET.has(schemeRaw)
        ? schemeRaw
        : defaults.hotWaterBoilerPowerMatchingScheme,
    indirectDhwSpaceAvailable: rec.indirectDhwSpaceAvailable === true,
  };
}

/**
 * @param {Record<string, unknown>} raw
 * @param {Record<string, unknown>} rawMeta
 */
function resolveWaterHeaterForm(raw, rawMeta) {
  const { indirectDhwSpaceAvailable: indirectFromMeta } = rawMeta;
  return normalizeWaterHeaterForm(
    typeof raw.waterHeaterForm === 'object' && raw.waterHeaterForm !== null
      ? raw.waterHeaterForm
      : {
          hotWaterBoilerPowerMatchingScheme: raw.hotWaterBoilerPowerMatchingScheme,
          indirectDhwSpaceAvailable: indirectFromMeta,
        },
  );
}

/**
 * @param {unknown} storedVersion
 */
function assertStoredSchemaVersion(storedVersion) {
  const n = Number(storedVersion);
  if (Number.isFinite(n) && n > SURVEY_DRAFT_SCHEMA_VERSION) {
    throw new Error(
      `Неподдерживаемая schemaVersion: ${n} (максимум ${SURVEY_DRAFT_SCHEMA_VERSION})`,
    );
  }
}

const baseMeta = {
  objectType: 'apartment',
  floors: 1,
  roomsCount: 2,
  externalWalls: { presetId: 'wall_gas_concrete_d500', facadeSystem: 'none' },
};

assert(SURVEY_DRAFT_SCHEMA_VERSION === 3, 'SURVEY_DRAFT_SCHEMA_VERSION = 3');

const fromAlternateFields = resolveWaterHeaterForm(
  {
    hotWaterBoilerPowerMatchingScheme: SCHEME_BOILER_SINGLE_INDIRECT_SUM,
  },
  { ...baseMeta, indirectDhwSpaceAvailable: true },
);
assert(
  fromAlternateFields.hotWaterBoilerPowerMatchingScheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM,
  'snapshot без waterHeaterForm: схема из корня',
);
assert(
  fromAlternateFields.indirectDhwSpaceAvailable === true,
  'snapshot без waterHeaterForm: флаг из objectMeta',
);

const fromEmptyBlock = resolveWaterHeaterForm(
  { waterHeaterForm: {} },
  baseMeta,
);
assert(
  fromEmptyBlock.hotWaterBoilerPowerMatchingScheme === SCHEME_BOILER_MAX_COMBI,
  'пустой waterHeaterForm: дефолтная схема',
);
assert(
  fromEmptyBlock.indirectDhwSpaceAvailable === false,
  'пустой waterHeaterForm: indirectDhwSpaceAvailable === false',
);

const fromBlock = resolveWaterHeaterForm(
  {
    waterHeaterForm: {
      hotWaterBoilerPowerMatchingScheme: SCHEME_BOILER_MAX_COMBI,
      indirectDhwSpaceAvailable: true,
    },
  },
  baseMeta,
);
assert(
  fromBlock.indirectDhwSpaceAvailable === true,
  'waterHeaterForm: флаг из блока',
);

let threw = false;
try {
  assertStoredSchemaVersion(SURVEY_DRAFT_SCHEMA_VERSION + 1);
} catch {
  threw = true;
}
assert(threw, 'schemaVersion больше текущей → ошибка');

assert(
  (() => {
    assertStoredSchemaVersion(SURVEY_DRAFT_SCHEMA_VERSION);
    return true;
  })(),
  'schemaVersion текущей → без ошибки',
);

assert(
  (() => {
    assertStoredSchemaVersion(undefined);
    return true;
  })(),
  'отсутствующая schemaVersion → без ошибки',
);

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nverifySurveyDraftMigration: all passed');
