/**
 * Назначение: guard минимального внутреннего диаметра при подборе труб.
 * Описание: Фильтрация пула каталога до скоростного подбора; приоритет геометрии над vMin.
 */

import { pipeInternalDiameterMm } from './pipeHydraulics.js';

/**
 * @param {import('./types').HydraulicsGraphEdge} edge
 * @param {import('./types').HydraulicsRules} rules
 * @returns {number}
 */
export function resolveMinInternalDiameterMm(edge, rules) {
  // Петли ТП: отдельный пул и min Ø в ufhLoopHydraulics.js
  if (edge.segmentRole === 'ufh_loop') {
    return 0;
  }
  if (edge.isMainLine === true) {
    return rules.mainTransitMinInternalDiameterMm ?? 20;
  }
  return rules.branchMinInternalDiameterMm ?? 12;
}

/**
 * @param {import('../catalog/types').PipeCatalogItemNormalized[]} pool — отсортирован по Ø↑
 * @param {number} minInternalMm
 * @returns {{
 *   pool: import('../catalog/types').PipeCatalogItemNormalized[];
 *   exhausted: boolean;
 * }}
 */
export function filterPoolByMinInternalDiameter(pool, minInternalMm) {
  const filtered = pool.filter(
    (pipe) => pipeInternalDiameterMm(pipe) >= minInternalMm,
  );
  return {
    pool: filtered,
    exhausted: filtered.length === 0,
  };
}
