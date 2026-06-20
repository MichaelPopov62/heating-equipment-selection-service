/**
 * Назначение: проверка нормализации summary.objectType для MongoDB enum.
 * Запуск: cd backend && npm run verify:extract-calculation-summary
 */
import {
  extractCalculationSummary,
  sanitizeCalculationSummary,
} from '../src/projects/extractCalculationSummary.js';

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

/** @param {Partial<import('../src/types/shared-types').CalcReport>} patch */
function minimalReport(patch = {}) {
  return /** @type {import('../src/types/shared-types').CalcReport} */ ({
    meta: { generatedAt: '2026-01-01T00:00:00.000Z', schemaVersion: 1 },
    input: {
      building: {
        objectMeta: { objectType: 'house', floors: 1, roomsCount: 1 },
      },
    },
    temps: { insideC: 20, outsideC: -5 },
    calculations: {
      heatLoss: { totalWatts: 5000 },
      hotWater: { objectType: 'house', hotWaterPowerKw: 12 },
    },
    matching: { boiler: { requiredKw: 8, selected: { model: 'Test' } } },
    warnings: [],
    ...patch,
  });
}

console.log('=== extractCalculationSummary: objectType ===');

const house = extractCalculationSummary(minimalReport());
tally(logCheck(house.objectType === 'house', 'input house + hotWater house → house'));

const apt = extractCalculationSummary(
  minimalReport({
    input: {
      building: {
        objectMeta: { objectType: 'villa', floors: 1, roomsCount: 1 },
      },
    },
    calculations: {
      heatLoss: { totalWatts: 5000 },
      hotWater: { objectType: 'apartment', hotWaterPowerKw: 12 },
    },
  }),
);
tally(
  logCheck(
    apt.objectType === 'apartment',
    'битый input.objectType + hotWater apartment → apartment (пайплайн)',
  ),
);

const fallbackHouse = extractCalculationSummary(
  minimalReport({
    input: {
      building: {
        objectMeta: { objectType: 'villa', floors: 1, roomsCount: 1 },
      },
    },
    calculations: {
      heatLoss: { totalWatts: 5000 },
      hotWater: { objectType: 'garbage', hotWaterPowerKw: 12 },
    },
  }),
);
tally(
  logCheck(
    fallbackHouse.objectType === 'house',
    'мусор в input и hotWater → house (resolveObjectType)',
  ),
);

const noMeta = extractCalculationSummary(
  minimalReport({
    input: { building: {} },
    calculations: {
      heatLoss: { totalWatts: 5000 },
      hotWater: { hotWaterPowerKw: 12 },
    },
  }),
);
tally(logCheck(noMeta.objectType === 'house', 'нет objectMeta → house'));

console.log('\n=== sanitizeCalculationSummary (legacy read) ===');

const clean = sanitizeCalculationSummary({ objectType: 'apartment', heatLossKw: 5 });
tally(logCheck(clean.objectType === 'apartment', 'валидный enum не трогаем'));

const legacy = sanitizeCalculationSummary({ objectType: 'villa', heatLossKw: 5 });
tally(logCheck(legacy.objectType === 'house', 'legacy villa → house'));

console.log(
  failed === 0
    ? '\nverifyExtractCalculationSummary: ALL OK'
    : `\nFAILED: ${failed}`,
);
process.exitCode = failed > 0 ? 1 : 0;
