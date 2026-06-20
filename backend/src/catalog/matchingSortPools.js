/**
 * Назначение: предсортированные пулы каталога для matching.
 * Описание: котлы (по max powerKw) и электронакопительные водонагреватели (по min volumeLiters)
 * с кэшем WeakMap на снимке NormalizedCatalog. Радиаторы, трубы и БКН здесь не индексируются:
 * радиаторы — sortRadiatorsForMatching() в matching/internal/pickRadiatorsCore.js;
 * остальное — прямой обход каталога в соответствующих pick* модулях.
 */
import {
  compareBoilersByMaxPowerAsc,
  compareWaterHeatersByMinVolumeAsc,
} from './comparators.js';

/** @type {WeakMap<object, { boilersSortedByMaxPower: import('./types').BoilerCatalogItemNormalized[], waterHeatersSortedByMinVolume: import('./types').WaterHeaterCatalogItemNormalized[] }>} */
const sortPoolsCache = new WeakMap();

/**
 * @param {import('./types').NormalizedCatalog} catalog
 * @returns {{
 *   boilersSortedByMaxPower: import('./types').BoilerCatalogItemNormalized[],
 *   waterHeatersSortedByMinVolume: import('./types').WaterHeaterCatalogItemNormalized[],
 * }}
 */
export function buildMatchingSortPools(catalog) {
  if (catalog && typeof catalog === 'object') {
    const cached = sortPoolsCache.get(catalog);
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

  const pools = {
    boilersSortedByMaxPower,
    waterHeatersSortedByMinVolume,
  };

  if (catalog && typeof catalog === 'object') {
    sortPoolsCache.set(catalog, pools);
  }

  return pools;
}
