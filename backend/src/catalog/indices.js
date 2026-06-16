/**
 * Назначение: индексы каталога для подбора.
 * Описание: предсортированные списки котлов по мощности и водонагревателей по объёму с кэшем
 * WeakMap для ускорения повторных обращений в matching.
 */
import {
  compareBoilersByMaxPowerAsc,
  compareWaterHeatersByMinVolumeAsc,
} from './comparators.js';

const indicesCache = new WeakMap();

/**
 * @param {import('./types').NormalizedCatalog} catalog
 * @returns {{
 *   boilersSortedByMaxPower: import('./types').BoilerCatalogItemNormalized[],
 *   waterHeatersSortedByMinVolume: import('./types').WaterHeaterCatalogItemNormalized[],
 * }}
 */
export function buildCatalogIndices(catalog) {
  if (catalog && typeof catalog === 'object') {
    const cached = indicesCache.get(catalog);
    if (cached) return cached;
  }

  const allBoilers = [
    ...(catalog?.boilers?.doubleCircuit ?? []),
    ...(catalog?.boilers?.singleCircuit ?? []),
  ];

  const boilersSortedByMaxPower = [...allBoilers].sort(compareBoilersByMaxPowerAsc);
  const waterHeatersSortedByMinVolume = [...(catalog?.waterHeaters ?? [])].sort(
    compareWaterHeatersByMinVolumeAsc,
  );

  const indices = {
    boilersSortedByMaxPower,
    waterHeatersSortedByMinVolume,
  };

  if (catalog && typeof catalog === 'object') {
    indicesCache.set(catalog, indices);
  }

  return indices;
}
