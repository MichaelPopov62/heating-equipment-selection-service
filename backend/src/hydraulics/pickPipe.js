/**
 * Назначение: подбор трубы из каталога по расходу и скорости.
 * Описание: Guard Dвн → минимальный Ø при v ≤ vMax; fallback вверх/вниз внутри guard-пула.
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
import { RAD_DISTRIBUTION_MANIFOLD_NODE_ID } from './radiatorGraphHelpers.js';
import {
  filterPoolByMinInternalDiameter,
  resolveMinInternalDiameterMm,
} from './pipeCatalogPoolFilter.js';
import {
  orderTrunkChainEdges,
  pickTrunkChainWithTaper,
  usesTrunkTaperPick,
} from './pickTrunkChain.js';

/**
 * @param {'main' | 'trunk' | 'branch' | 'ufh_collector_transit' | 'ufh_loop' | 'dhw'} segmentRole
 * @param {import('./types.js').HydraulicsRules} rules
 * @returns {number}
 */
function resolveVelocityMaxMps(segmentRole, rules) {
  return segmentRole === 'main'
    || segmentRole === 'trunk'
    || segmentRole === 'ufh_collector_transit'
    ? rules.velocityLimitsMps.mainMax
    : rules.velocityLimitsMps.branchMax;
}

/**
 * @param {import('../catalog/types.js').PipeCatalogItemNormalized[]} pipes
 * @param {import('./types.js').HydraulicsSurveyInput['pipeMaterialPreference']} [materialPreference]
 * @returns {import('../catalog/types.js').PipeCatalogItemNormalized[]}
 */
function filterPipePool(pipes, materialPreference) {
  /** @type {import('../catalog/types.js').PipeCatalogItemNormalized[]} */
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
 * @param {import('../catalog/types.js').PipeCatalogItemNormalized[]} args.pool
 * @param {number} args.flowM3PerHour
 * @param {number} args.vMax
 * @param {number} args.vMin
 * @returns {{
 *   pipe: import('../catalog/types.js').PipeCatalogItemNormalized;
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
 * @param {import('./types.js').HydraulicsGraphEdge} edge
 * @param {import('./types.js').HydraulicsRules} rules
 * @param {import('../catalog/types.js').PipeCatalogItemNormalized[]} materialPool
 * @returns {{
 *   pool: import('../catalog/types.js').PipeCatalogItemNormalized[];
 *   exhausted: boolean;
 *   minInternalMm: number;
 *   mainTransitGuardApplied: boolean;
 * }}
 */
function applyInternalDiameterGuard(edge, rules, materialPool) {
  const minInternalMm = resolveMinInternalDiameterMm(edge, rules);
  const { pool, exhausted } = filterPoolByMinInternalDiameter(
    materialPool,
    minInternalMm,
  );
  return {
    pool,
    exhausted,
    minInternalMm,
    mainTransitGuardApplied: edge.isMainLine === true,
  };
}

/**
 * @param {object} args
 * @param {import('./types.js').HydraulicsGraphEdge} args.edge
 * @param {import('../catalog/types.js').NormalizedCatalog['pipes']} args.pipes
 * @param {string} args.catalogPipeId
 * @param {import('./types.js').HydraulicsRules} args.rules
 * @param {number} [args.localZeta]
 * @returns {import('./types.js').HydraulicsPipeMatchItem | null}
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
 * @param {import('./types.js').HydraulicsGraphEdge} args.edge
 * @param {import('../catalog/types.js').NormalizedCatalog['pipes']} args.pipes
 * @param {import('./types.js').HydraulicsRules} args.rules
 * @param {import('./types.js').HydraulicsSurveyInput['pipeMaterialPreference']} [args.materialPreference]
 * @param {number} [args.localZeta]
 * @returns {import('./types.js').HydraulicsPipeMatchItem | null}
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
  const materialPool = filterPipePool(pipes, materialPreference);
  if (!materialPool.length) return null;

  const guard = applyInternalDiameterGuard(edge, rules, materialPool);
  if (guard.exhausted) {
    return {
      edgeId: edge.id,
      catalogPipeId: '',
      velocityMps: 0,
      pressureDropKPa: 0,
      internalDiameterMm: 0,
      catalogPoolExhausted: true,
      ...(guard.mainTransitGuardApplied
        ? { mainTransitGuardApplied: true }
        : {}),
    };
  }

  const { pipe: chosen, velocityLimitExceeded, velocityBelowMin } = selectPipeFromPool({
    pool: guard.pool,
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
    ...(guard.mainTransitGuardApplied
      ? { mainTransitGuardApplied: true }
      : {}),
  };
}

/**
 * @param {import('./types.js').HydraulicsGraphEdge} edge
 * @param {import('./types.js').HydraulicsRules} rules
 * @param {import('./types.js').HydraulicsApplianceRules['localLossZeta']} zeta
 * @returns {number}
 */
function resolveLocalZetaForEdge(edge, rules, zeta) {
  if (edge.segmentRole === 'trunk' && edge.teeRole === 'pass_through') {
    return zeta.teePass;
  }
  if (edge.segmentRole === 'branch' && edge.teeRole === 'branch_takeoff') {
    return zeta.teeBranchTakeoff + zeta.elbow90;
  }
  if (edge.to === RAD_DISTRIBUTION_MANIFOLD_NODE_ID) {
    return zeta.collector;
  }

  let localZeta =
    edge.segmentRole === 'ufh_loop'
      ? zeta.collector + zeta.elbow90
      : edge.segmentRole === 'ufh_collector_transit'
        ? zeta.collector + zeta.elbow90
        : edge.segmentRole === 'branch'
          ? zeta.teeBranch + zeta.elbow90
          : edge.segmentRole === 'main'
            ? zeta.elbow90
            : edge.segmentRole === 'trunk'
              ? zeta.teePass
              : 0;

  if (edge.to === RAD_MICRO_MANIFOLD_NODE_ID) {
    localZeta += rules.radiatorBranchGrouping.localZetaManifold;
  }
  if (edge.from === RAD_DISTRIBUTION_MANIFOLD_NODE_ID) {
    localZeta = zeta.teeBranch + zeta.elbow90;
  }
  return localZeta;
}

/**
 * @param {import('./types.js').HydraulicsGraphEdge} edge
 * @param {import('./types.js').HydraulicsRules} rules
 * @returns {number}
 */
function resolveVelocityMinForEdge(edge, rules) {
  if (edge.isMainLine === true || edge.segmentRole === 'trunk') {
    return rules.velocityLimitsMps.mainMin;
  }
  return resolveVelocityMinMps(edge.segmentRole, rules);
}

/**
 * @param {object} args
 * @param {import('./types.js').HydraulicsGraph} args.graph
 * @param {import('../catalog/types.js').NormalizedCatalog} args.catalog
 * @param {import('./types.js').HydraulicsPipelineInput} args.dto
 * @returns {{ pipes: import('./types.js').HydraulicsPipeMatchItem[]; warnings: string[] }}
 */
export function pickPipesForGraph({ graph, catalog, dto }) {
  /** @type {import('./types.js').HydraulicsPipeMatchItem[]} */
  const pipes = [];
  /** @type {string[]} */
  const warnings = [];
  const zeta = dto.rules.localLossZeta;

  /** @type {Map<string, import('./types.js').HydraulicsPipeMatchItem | null>} */
  const trunkChainMatches = new Map();
  /** @type {Set<string>} */
  const trunkChainEdgeIds = new Set();

  if (usesTrunkTaperPick(dto.layout.radiatorWiringSystemType)) {
    const chain = orderTrunkChainEdges(graph);
    for (const edge of chain) {
      trunkChainEdgeIds.add(edge.id);
    }
    if (chain.length > 0) {
      const chainResults = pickTrunkChainWithTaper({
        chain,
        pipes: catalog.pipes ?? [],
        rules: dto.rules,
        materialPreference: dto.layout.pipeMaterialPreference,
        resolveLocalZeta: (edge) => resolveLocalZetaForEdge(edge, dto.rules, zeta),
        filterMaterialPool: filterPipePool,
      });
      for (const [edgeId, match] of chainResults) {
        trunkChainMatches.set(edgeId, match);
      }
    }
  }

  for (const edge of graph.edges) {
    const localZeta = resolveLocalZetaForEdge(edge, dto.rules, zeta);

    const preferredId = edge.preferredCatalogPipeId;
    const match =
      trunkChainEdgeIds.has(edge.id)
        ? trunkChainMatches.get(edge.id) ?? null
        : preferredId
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
      if (match.catalogPoolExhausted) {
        const minInternal = match.trunkTaperFloorMm
          ?? resolveMinInternalDiameterMm(edge, dto.rules);
        warnings.push(
          `Участок ${edge.id}: в каталоге нет трубы с Dвн ≥ ${minInternal} мм.`,
        );
      } else {
        pipes.push(match);
        const vMax = resolveVelocityMaxMps(edge.segmentRole, dto.rules);
        const vMin = resolveVelocityMinForEdge(edge, dto.rules);
        if (match.velocityLimitExceeded) {
          warnings.push(
            `Участок ${edge.id}: скорость ${match.velocityMps} м/с выше лимита ${vMax} м/с — подобран максимальный Ø каталога.`,
          );
        } else if (match.velocityBelowMin) {
          if (match.mainTransitGuardApplied) {
            warnings.push(
              `Участок ${edge.id}: скорость ${match.velocityMps} м/с ниже минимума ${vMin} м/с `
              + `— применён guard Dвн ≥ ${dto.rules.mainTransitMinInternalDiameterMm} мм.`,
            );
          } else if (
            edge.segmentRole === 'trunk'
            && match.trunkTaperFromDownstreamMm != null
          ) {
            warnings.push(
              `Участок ${edge.id}: скорость ${match.velocityMps} м/с ниже минимума ${vMin} м/с `
              + `— удержан Ø ≥ ${match.trunkTaperFromDownstreamMm} мм downstream (без отката к guard 12 мм).`,
            );
          } else {
            warnings.push(
              `Участок ${edge.id}: скорость ${match.velocityMps} м/с ниже минимума ${vMin} м/с — подобран минимальный Ø.`,
            );
          }
        } else if (match.velocityMps > vMax) {
          warnings.push(
            `Участок ${edge.id}: скорость ${match.velocityMps} м/с выше лимита ${vMax} м/с — проверьте каталог.`,
          );
        }
      }
    } else if (edge.designFlowM3PerHour > 0) {
      warnings.push(`Участок ${edge.id}: не удалось подобрать трубу из каталога.`);
    }
  }

  return { pipes, warnings };
}
