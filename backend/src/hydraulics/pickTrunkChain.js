/**
 * Назначение: подбор последовательной магистрали trunk (dead-end / pass).
 * Описание: монотонное заужение Ø по потоку — upstream Dвн ≥ downstream; при v&lt;vMin не откат к guard 12 мм.
 */

import {
  computeSegmentHydraulics,
  pipeInternalDiameterMm,
  pipeVelocityMps,
  pickLargestPipe,
  pickSmallestPipe,
  pickSmallestPipeWithinVelocityRange,
  resolveRoughnessMm,
} from './pipeHydraulics.js';

const TRUNK_JUNCTION_ID_RE = /^rad_trunk_j_(\d+)$/;

/**
 * @param {string} nodeId
 * @returns {number | null}
 */
function trunkJunctionIndex(nodeId) {
  const match = TRUNK_JUNCTION_ID_RE.exec(nodeId);
  return match ? Number(match[1]) : null;
}

/**
 * Упорядочивает trunk-рёбра магистрали от upstream к downstream (j0→j1→…).
 *
 * @param {import('./types').HydraulicsGraph} graph
 * @returns {import('./types').HydraulicsGraphEdge[]}
 */
export function orderTrunkChainEdges(graph) {
  return graph.edges
    .filter(
      (edge) =>
        edge.segmentRole === 'trunk'
        && trunkJunctionIndex(edge.from) != null,
    )
    .sort((a, b) => {
      const ai = trunkJunctionIndex(a.from) ?? 0;
      const bi = trunkJunctionIndex(b.from) ?? 0;
      return ai - bi;
    });
}

/**
 * @param {import('../catalog/types').PipeCatalogItemNormalized[]} materialPool
 * @param {number} floorMm
 * @returns {import('../catalog/types').PipeCatalogItemNormalized[]}
 */
function poolAtOrAboveDiameter(materialPool, floorMm) {
  return materialPool.filter(
    (pipe) => pipeInternalDiameterMm(pipe) >= floorMm,
  );
}

/**
 * Подбор одного trunk-участка с нижней границей Ø от downstream-сегмента.
 *
 * @param {object} args
 * @param {import('./types').HydraulicsGraphEdge} args.edge
 * @param {import('../catalog/types').PipeCatalogItemNormalized[]} args.materialPool
 * @param {import('./types').HydraulicsRules} args.rules
 * @param {number} args.minInternalMmFromDownstream — Ø downstream; 0 на последнем участке цепочки
 * @param {number} args.localZeta
 * @returns {import('./types').HydraulicsPipeMatchItem | null}
 */
export function pickTrunkEdgeWithTaper({
  edge,
  materialPool,
  rules,
  minInternalMmFromDownstream,
  localZeta,
}) {
  if (!materialPool.length || edge.designFlowM3PerHour <= 0) return null;

  const vMax = rules.velocityLimitsMps.mainMax;
  const vMin = rules.velocityLimitsMps.mainMin;
  const absoluteFloorMm = rules.branchMinInternalDiameterMm ?? 12;
  const floorMm =
    minInternalMmFromDownstream > 0
      ? minInternalMmFromDownstream
      : absoluteFloorMm;

  const pool = poolAtOrAboveDiameter(materialPool, floorMm);
  if (!pool.length) {
    return {
      edgeId: edge.id,
      catalogPipeId: '',
      velocityMps: 0,
      pressureDropKPa: 0,
      internalDiameterMm: 0,
      catalogPoolExhausted: true,
      trunkTaperFloorMm: floorMm,
    };
  }

  const flow = edge.designFlowM3PerHour;
  let chosen = pickSmallestPipeWithinVelocityRange(pool, flow, vMin, vMax);
  let velocityLimitExceeded = false;
  let velocityBelowMin = false;

  if (!chosen) {
    const smallestAtFloor = pickSmallestPipe(pool);
    if (!smallestAtFloor) return null;

    const vAtFloor = pipeVelocityMps(smallestAtFloor, flow);
    if (vAtFloor > vMax) {
      chosen = pickLargestPipe(pool);
      velocityLimitExceeded = true;
    } else {
      chosen = smallestAtFloor;
      if (vAtFloor < vMin) {
        velocityBelowMin = true;
      }
    }
  }

  const internalMm = pipeInternalDiameterMm(chosen);
  const roughness = resolveRoughnessMm(
    chosen.material,
    rules.roughnessMmByMaterial,
  );
  const hyd = computeSegmentHydraulics({
    flowM3PerHour: flow,
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
    ...(minInternalMmFromDownstream > 0
      ? { trunkTaperFromDownstreamMm: minInternalMmFromDownstream }
      : {}),
  };
}

/**
 * Каскадный подбор цепочки trunk: от downstream к upstream, монотонное заужение.
 *
 * @param {object} args
 * @param {import('./types').HydraulicsGraphEdge[]} args.chain — upstream→downstream
 * @param {import('../catalog/types').NormalizedCatalog['pipes']} args.pipes
 * @param {import('./types').HydraulicsRules} args.rules
 * @param {import('./types').HydraulicsSurveyInput['pipeMaterialPreference']} [args.materialPreference]
 * @param {(edge: import('./types').HydraulicsGraphEdge) => number} args.resolveLocalZeta
 * @param {(pipe: import('../catalog/types').PipeCatalogItemNormalized[]) => import('../catalog/types').PipeCatalogItemNormalized[]} args.filterMaterialPool
 * @returns {Map<string, import('./types').HydraulicsPipeMatchItem | null>}
 */
export function pickTrunkChainWithTaper({
  chain,
  pipes,
  rules,
  materialPreference,
  resolveLocalZeta,
  filterMaterialPool,
}) {
  /** @type {Map<string, import('./types').HydraulicsPipeMatchItem | null>} */
  const matches = new Map();
  if (!chain.length || !pipes?.length) return matches;

  const materialPool = filterMaterialPool(pipes ?? [], materialPreference);
  let downstreamFloorMm = 0;

  for (let i = chain.length - 1; i >= 0; i -= 1) {
    const edge = chain[i];
    const match = pickTrunkEdgeWithTaper({
      edge,
      materialPool,
      rules,
      minInternalMmFromDownstream: downstreamFloorMm,
      localZeta: resolveLocalZeta(edge),
    });
    matches.set(edge.id, match);
    if (match?.internalDiameterMm && match.internalDiameterMm > 0) {
      downstreamFloorMm = match.internalDiameterMm;
    }
  }

  return matches;
}

/**
 * @param {import('./types').RadiatorWiringSystemType | undefined} wiringType
 * @returns {boolean}
 */
export function usesTrunkTaperPick(wiringType) {
  return wiringType === 'two-pipe-dead-end' || wiringType === 'two-pipe-pass';
}
