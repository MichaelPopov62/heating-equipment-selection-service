/**
 * Назначение: подбор трубы из каталога по расходу и скорости.
 * Описание: Минимальный Ø при v ≤ vMax; диаметры только на выходе matching.
 */

import {
  computeSegmentHydraulics,
  pipeInternalDiameterMm,
  pipeMeetsVelocityLimit,
  resolveRoughnessMm,
} from './pipeHydraulics.js';

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

  const vMax =
    edge.segmentRole === 'main'
      ? rules.velocityLimitsMps.mainMax
      : rules.velocityLimitsMps.branchMax;

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

  /** @type {import('../catalog/types').PipeCatalogItemNormalized | null} */
  let chosen = null;
  for (const pipe of pool) {
    if (pipeMeetsVelocityLimit(pipe, edge.designFlowM3PerHour, vMax)) {
      chosen = pipe;
      break;
    }
  }
  if (!chosen && pool.length) {
    chosen = pool[pool.length - 1];
  }
  if (!chosen) return null;

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
  };
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
    const localZeta =
      edge.segmentRole === 'ufh_loop'
        ? zeta.collector + zeta.elbow90
        : edge.segmentRole === 'branch'
          ? zeta.teeBranch + zeta.elbow90
          : edge.segmentRole === 'main'
            ? zeta.elbow90
            : 0;

    const match = pickPipeForEdge({
      edge,
      pipes: catalog.pipes ?? [],
      rules: dto.rules,
      materialPreference: dto.layout.pipeMaterialPreference,
      localZeta,
    });

    if (match) {
      pipes.push(match);
      const vMax =
        edge.segmentRole === 'main'
          ? dto.rules.velocityLimitsMps.mainMax
          : dto.rules.velocityLimitsMps.branchMax;
      if (match.velocityMps > vMax) {
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
