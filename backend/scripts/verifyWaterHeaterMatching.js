/**
 * Назначение: проверка приоритетов подбора электрического накопительного водонагревателя.
 * Запуск: npm run verify:water-heater-matching (из backend/).
 */
import assert from 'node:assert/strict';
import { pickWaterHeater } from '../src/matching/waterHeater.js';

/**
 * Создаёт минимальный нормализованный каталог для проверки подбора.
 *
 * @param {import('../src/catalog/types.js').WaterHeaterCatalogItemNormalized[]} waterHeaters
 * @returns {import('../src/catalog/types.js').NormalizedCatalog}
 */
function buildCatalog(waterHeaters) {
  return {
    boilers: { doubleCircuit: [], singleCircuit: [] },
    radiators: [],
    waterHeaters,
  };
}

/**
 * Запускает подбор для заданного расчётного объёма.
 *
 * @param {number} requiredTankLiters
 * @param {import('../src/catalog/types.js').WaterHeaterCatalogItemNormalized[]} waterHeaters
 * @returns {import('../src/types/shared-types.js').WaterHeaterMatchingReport}
 */
function match(requiredTankLiters, waterHeaters) {
  return pickWaterHeater({
    hotWater: /** @type {import('../src/types/shared-types.js').HotWaterReport} */ ({
      recommendedTankLiters: requiredTankLiters,
    }),
    catalog: buildCatalog(waterHeaters),
  });
}

const sameVolumeCatalog = [
  {
    model: 'Atlantic',
    type: 'electric_storage',
    variants: [{ volumeLiters: 80, price: 8198 }],
  },
  {
    model: 'Tesy',
    type: 'electric_storage',
    variants: [{ volumeLiters: 80, price: 6490 }],
  },
  {
    model: 'Ariston',
    type: 'electric_storage',
    variants: [{ volumeLiters: 50, price: 13100 }],
  },
];

const cheapestEqualVolume = match(80, sameVolumeCatalog);
assert.equal(cheapestEqualVolume.selected?.model, 'Tesy');
assert.equal(cheapestEqualVolume.chosenVariant?.volumeLiters, 80);
assert.equal(cheapestEqualVolume.chosenVariant?.price, 6490);

const minimalSufficientVolume = match(80, [
  {
    model: 'Larger but cheaper',
    type: 'electric_storage',
    variants: [{ volumeLiters: 100, price: 5000 }],
  },
  {
    model: 'Exact volume',
    type: 'electric_storage',
    variants: [{ volumeLiters: 80, price: 7000 }],
  },
]);
assert.equal(minimalSufficientVolume.selected?.model, 'Exact volume');
assert.equal(minimalSufficientVolume.chosenVariant?.volumeLiters, 80);

const cheapestFallback = match(120, [
  {
    model: 'Expensive fallback',
    type: 'electric_storage',
    variants: [{ volumeLiters: 100, price: 9000 }],
  },
  {
    model: 'Budget fallback',
    type: 'electric_storage',
    variants: [{ volumeLiters: 100, price: 8000 }],
  },
]);
assert.equal(cheapestFallback.selected?.model, 'Budget fallback');
assert.equal(cheapestFallback.chosenVariant?.price, 8000);
assert.equal(cheapestFallback.warnings.length, 1);

console.log('OK: подбор водонагревателя учитывает минимальную цену при равном объёме.');
