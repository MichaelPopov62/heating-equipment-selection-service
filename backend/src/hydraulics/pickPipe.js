/**
 * Назначение: подбор трубы из каталога по расходу и скорости.
 * Описание: Минимальный Ø при v ≤ vMax; fallback вверх при перегрузке, вниз при микропотоке.
 */

import {
  computeSegmentHydraulics,
  pipeInternalDiameterMm,
  pipeVelocityMps,
  pickLargestPipe,
  pickSmallestPipe,
  pickSmallestPipeWithinVelocityRange,
  resolveRoughnessMm,
  resolveVelocityMinMps,
} from './pipeHydraulics.js';
import { RAD_MICRO_MANIFOLD_NODE_ID } from './groupRadiatorGraphBranches.js';

/**
 * @param {'main' | 'branch' | 'ufh_loop' | 'dhw'} segmentRole
 * @param {import('./types').HydraulicsRules} rules
 * @returns {number}
 */
function resolveVelocityMaxMps(segmentRole, rules) {
  return segmentRole === 'main'
    ? rules.velocityLimitsMps.mainMax
    : rules.velocityLimitsMps.branchMax;
}

/**
 * @param {import('../catalog/types').PipeCatalogItemNormalized[]} pipes
 * @param {import('./types').HydraulicsSurveyInput['pipeMaterialPreference']} [materialPreference]
 * @returns {import('../catalog/types').PipeCatalogItemNormalized[]}
 */
function filterPipePool(pipes, materialPreference) {
  /** @type {import('../catalog/types').PipeCatalogItemNormalized[]} */
  let pool = [...pipes];

  if (materialPreference) {
    const pref = materialPreference.toLowerCase();
    const filtered = pool.filter((p) => {
      const m = String(p.material ?? '').toLowerCase();
      if (pref === 'pex') return m.includes('pex');
      if (pref === 'metal_plastic') {
        return m.includes('metal') || m.includes('pex-al') || m.includes('ал');
      }
      if (pref === 'steel') return m.includes('steel') || m.includes('сталь');
      return true;
    });
    if (filtered.length) pool = filtered;
  }

  pool.sort(
    (a, b) => pipeInternalDiameterMm(a) - pipeInternalDiameterMm(b),
  );
  return pool;
}

/**
 * @param {object} args
 * @param {import('../catalog/types').PipeCatalogItemNormalized[]} args.pool
 * @param {number} args.flowM3PerHour
 * @param {number} args.vMax
 * @param {number} args.vMin
 * @returns {{
 *   pipe: import('../catalog/types').PipeCatalogItemNormalized;
 *   velocityLimitExceeded?: boolean;
 *   velocityBelowMin?: boolean;
 * }}
 */
function selectPipeFromPool({ pool, flowM3PerHour, vMax, vMin }) {
  const withinRange = pickSmallestPipeWithinVelocityRange(
    pool,
    flowM3PerHour,
    vMin,
    vMax,
  );
  if (withinRange) {
    return { pipe: withinRange };
  }

  const smallest = pickSmallestPipe(pool);
  const largest = pickLargestPipe(pool);
  if (!smallest || !largest) {
    throw new Error('pickPipe: пустой пул каталога');
  }

  if (pipeVelocityMps(smallest, flowM3PerHour) > vMax) {
    return { pipe: largest, velocityLimitExceeded: true };
  }
  return { pipe: smallest, velocityBelowMin: true };
}

/**
 * @param {object} args
 * @param {import('./types').HydraulicsGraphEdge} args.edge
 * @param {import('../catalog/types').NormalizedCatalog['pipes']} args.pipes
 * @param {string} args.catalogPipeId
 * @param {import('./types').HydraulicsRules} args.rules
 * @param {number} [args.localZeta]
 * @returns {import('./types').HydraulicsPipeMatchItem | null}
 */
export function pickPipeForEdgeByCatalogId({
  edge,
  pipes,
  catalogPipeId,
  rules,
  localZeta = 0,
}) {
  const pipe = pipes?.find((p) => p.id === catalogPipeId);
  if (!pipe || edge.designFlowM3PerHour <= 0) return null;

  const internalMm = pipeInternalDiameterMm(pipe);
  const roughness = resolveRoughnessMm(pipe.material, rules.roughnessMmByMaterial);
  const hyd = computeSegmentHydraulics({
    flowM3PerHour: edge.designFlowM3PerHour,
    lengthM: edge.lengthM,
    internalDiameterMm: internalMm,
    roughnessMm: roughness,
    localZeta,
  });

  return {
    edgeId: edge.id,
    catalogPipeId: pipe.id,
    velocityMps: hyd.velocityMps,
    pressureDropKPa: hyd.pressureDropKPa,
    internalDiameterMm: internalMm,
  };
}

/**
 * @param {object} args
 * @param {import('./types').HydraulicsGraphEdge} args.edge
 * @param {import('../catalog/types').NormalizedCatalog['pipes']} args.pipes
 * @param {import('./types').HydraulicsRules} args.rules
 * @param {import('./types').HydraulicsSurveyInput['pipeMaterialPreference']} [args.materialPreference]
 * @param {number} [args.localZeta]
 * @returns {import('./types').HydraulicsPipeMatchItem | null}
 */
export function pickPipeForEdge({
  edge,
  pipes,
  rules,
  materialPreference,
  localZeta = 0,
}) {
  if (!pipes?.length || edge.designFlowM3PerHour <= 0) return null;

  const vMax = resolveVelocityMaxMps(edge.segmentRole, rules);
  const vMin = resolveVelocityMinMps(edge.segmentRole, rules);
  const pool = filterPipePool(pipes, materialPreference);
  if (!pool.length) return null;

  const { pipe: chosen, velocityLimitExceeded, velocityBelowMin } = selectPipeFromPool({
    pool,
    flowM3PerHour: edge.designFlowM3PerHour,
    vMax,
    vMin,
  });

  const internalMm = pipeInternalDiameterMm(chosen);
  const roughness = resolveRoughnessMm(
    chosen.material,
    rules.roughnessMmByMaterial,
  );
  const hyd = computeSegmentHydraulics({
    flowM3PerHour: edge.designFlowM3PerHour,
    lengthM: edge.lengthM,
    internalDiameterMm: internalMm,
    roughnessMm: roughness,
    localZeta,
  });

  return {
    edgeId: edge.id,
    catalogPipeId: chosen.id,
    velocityMps: hyd.velocityMps,
    pressureDropKPa: hyd.pressureDropKPa,
    internalDiameterMm: internalMm,
    ...(velocityLimitExceeded ? { velocityLimitExceeded: true } : {}),
    ...(velocityBelowMin ? { velocityBelowMin: true } : {}),
  };
}

/**
 * @param {import('./types').HydraulicsGraphEdge} edge
 * @param {import('./types').HydraulicsRules} rules
 * @param {import('./types').HydraulicsApplianceRules['localLossZeta']} zeta
 * @returns {number}
 */
function resolveLocalZetaForEdge(edge, rules, zeta) {
  let localZeta =
    edge.segmentRole === 'ufh_loop'
      ? zeta.collector + zeta.elbow90
      : edge.segmentRole === 'branch'
        ? zeta.teeBranch + zeta.elbow90
        : edge.segmentRole === 'main'
          ? zeta.elbow90
          : 0;

  if (edge.to === RAD_MICRO_MANIFOLD_NODE_ID) {
    localZeta += rules.radiatorBranchGrouping.localZetaManifold;
  }
  return localZeta;
}

/**
 * @param {object} args
 * @param {import('./types').HydraulicsGraph} args.graph
 * @param {import('../catalog/types').NormalizedCatalog} args.catalog
 * @param {import('./types').HydraulicsPipelineInput} args.dto
 * @returns {{ pipes: import('./types').HydraulicsPipeMatchItem[]; warnings: string[] }}
 */
export function pickPipesForGraph({ graph, catalog, dto }) {
  /** @type {import('./types').HydraulicsPipeMatchItem[]} */
  const pipes = [];
  /** @type {string[]} */
  const warnings = [];
  const zeta = dto.rules.localLossZeta;

  for (const edge of graph.edges) {
    const localZeta = resolveLocalZetaForEdge(edge, dto.rules, zeta);

    const preferredId = edge.preferredCatalogPipeId;
    const match =
      preferredId
        ? pickPipeForEdgeByCatalogId({
            edge,
            pipes: catalog.pipes ?? [],
            catalogPipeId: preferredId,
            rules: dto.rules,
            localZeta,
          })
        : pickPipeForEdge({
            edge,
            pipes: catalog.pipes ?? [],
            rules: dto.rules,
            materialPreference: dto.layout.pipeMaterialPreference,
            localZeta,
          });

    if (match) {
      pipes.push(match);
      const vMax = resolveVelocityMaxMps(edge.segmentRole, dto.rules);
      const vMin = resolveVelocityMinMps(edge.segmentRole, dto.rules);
      if (match.velocityLimitExceeded) {
        warnings.push(
          `Участок ${edge.id}: скорость ${match.velocityMps} м/с выше лимита ${vMax} м/с — подобран максимальный Ø каталога.`,
        );
      } else if (match.velocityBelowMin) {
        warnings.push(
          `Участок ${edge.id}: скорость ${match.velocityMps} м/с ниже минимума ${vMin} м/с — подобран минимальный Ø.`,
        );
      } else if (match.velocityMps > vMax) {
        warnings.push(
          `Участок ${edge.id}: скорость ${match.velocityMps} м/с выше лимита ${vMax} м/с — проверьте каталог.`,
        );
      }
    } else if (edge.designFlowM3PerHour > 0) {
      warnings.push(`Участок ${edge.id}: не удалось подобрать трубу из каталога.`);
    }
  }

  return { pipes, warnings };
}
