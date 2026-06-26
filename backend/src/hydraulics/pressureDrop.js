/**
 * Назначение: расчёт потерь напора и критического контура.
 * Описание: Суммирует Δp по циркуляционным кольцам; учитывает mixingNode.headMetersMin.
 */

import { computeCirculationLoops } from './circulationLoops.js';
import { round } from '../utils/math.js';

export { resolveDesignPumpFlowM3h } from './resolveCirculationFlows.js';

/**
 * @param {object} args
 * @param {import('./types').HydraulicsGraph} args.graph
 * @param {import('./types').HydraulicsPipeMatchItem[]} args.pipes
 * @param {import('./types').HydraulicsPipelineInput} args.dto
 * @returns {import('./types').HydraulicsPressureReport}
 */
export function computePressureReport({ graph, pipes, dto }) {
  const pipeByEdge = new Map(pipes.map((p) => [p.edgeId, p]));

  /** @type {import('./types').HydraulicsPressureSegment[]} */
  const segments = [];

  for (const edge of graph.edges) {
    if (edge.fluid !== 'heating') continue;
    const pipe = pipeByEdge.get(edge.id);
    segments.push({
      edgeId: edge.id,
      lengthM: edge.lengthM,
      velocityMps: pipe?.velocityMps ?? 0,
      pressureDropKPa: pipe?.pressureDropKPa ?? 0,
      catalogPipeId: pipe?.catalogPipeId,
    });
  }

  const balancingKPaPerTurn =
    dto.rules.balancingValveKPaPerTurn ?? 3;

  const circulation = computeCirculationLoops({
    graph,
    pipes,
    balancingValveKPaPerTurn: balancingKPaPerTurn,
  });

  let headRequiredM = circulation.headRequiredM;
  const criticalEdgeIds = circulation.criticalLoopEdgeIds;

  const mixingMin = dto.circuits.underfloor?.mixingNode?.headMetersMin;
  if (typeof mixingMin === 'number' && mixingMin > headRequiredM) {
    headRequiredM = round(mixingMin, 2);
  }

  if (dto.source.requiredKw > 50 && dto.circuits.underfloor?.isMixingNodeRequired) {
    const sepMin =
      dto.rules.localLossZeta.collector > 0
        ? 5
        : headRequiredM;
    if (sepMin > headRequiredM) headRequiredM = sepMin;
  }

  return {
    criticalLoopEdgeIds: criticalEdgeIds,
    headRequiredM,
    criticalPressureDropKPa: circulation.criticalPressureDropKPa,
    criticalLoop: circulation.criticalLoop ?? undefined,
    circulationLoops: circulation.branches,
    balancingRecommendations: circulation.balancingRecommendations,
    segments,
  };
}

/**
 * @param {import('./types').HydraulicsPipelineInput} dto
 * @returns {import('./types').HydraulicsConsumerSummary[]}
 */
export function buildConsumerSummaries(dto) {
  /** @type {import('./types').HydraulicsConsumerSummary[]} */
  const out = [];
  if (dto.circuits.radiators) {
    out.push({
      circuit: 'radiators',
      totalFlowRateM3PerHour: dto.circuits.radiators.totalFlowRateM3PerHour,
      totalHeatLoadWatts: dto.circuits.radiators.consumers.reduce(
        (s, c) => s + c.heatLoadWatts,
        0,
      ),
    });
  }
  if (dto.circuits.underfloor) {
    out.push({
      circuit: 'underfloor',
      totalFlowRateM3PerHour: dto.circuits.underfloor.aggregate.flowRateM3PerHour,
      totalHeatLoadWatts: dto.circuits.underfloor.aggregate.heatLoadWatts,
    });
  }
  if (dto.circuits.dhw) {
    out.push({
      circuit: 'dhw',
      totalFlowRateM3PerHour: round(
        (dto.circuits.dhw.peakFlowLps * 3600) / 1000,
        3,
      ),
    });
  }
  return out;
}

/**
 * @param {number} flowM3PerHour
 * @returns {string}
 */
export function coarseRecommendedDn(flowM3PerHour) {
  if (flowM3PerHour > 1.5) return 'DN25–DN32';
  if (flowM3PerHour > 0.9) return 'DN20–DN25';
  if (flowM3PerHour > 0.4) return 'DN20';
  return 'DN15–DN20';
}
