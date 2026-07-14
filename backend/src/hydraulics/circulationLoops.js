/**
 * Назначение: расчёт циркуляционных колец и выявление «худшей ветки».
 * Описание: Суммирует Δp по полному пути котёл → потребитель (×2 на обратку),
 * выбирает критическое кольцо для насоса и рекомендации балансировки.
 */

import { round } from '../utils/math.js';

/** @type {import('./types.js').HydraulicsNodeKind[]} */
const LEAF_NODE_KINDS = [
  'radiator_consumer',
  'radiator_manifold',
  'ufh_loop',
  'dhw_load',
  'indirect_coil',
];

/**
 * @param {import('./types.js').HydraulicsGraph} graph
 * @returns {import('./types.js').HydraulicsGraphNode[]}
 */
function findLeafNodes(graph) {
  const incoming = new Set(graph.edges.map((e) => e.to));
  return graph.nodes.filter(
    (n) => LEAF_NODE_KINDS.includes(n.kind) || !incoming.has(n.id),
  );
}

/**
 * @param {import('./types.js').HydraulicsGraph} graph
 * @param {string} leafId
 * @returns {import('./types.js').HydraulicsGraphEdge[]}
 */
function tracePathFromBoiler(graph, leafId) {
  /** @type {Map<string, import('./types.js').HydraulicsGraphEdge>} */
  const parentEdge = new Map();
  /** @type {string[]} */
  const queue = ['boiler'];
  /** @type {Set<string>} */
  const visited = new Set(['boiler']);

  while (queue.length) {
    const nodeId = queue.shift();
    if (nodeId === leafId) break;

    for (const edge of graph.edges) {
      if (edge.from !== nodeId || edge.fluid !== 'heating') continue;
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      parentEdge.set(edge.to, edge);
      queue.push(edge.to);
    }
  }

  if (!visited.has(leafId)) return [];

  /** @type {import('./types.js').HydraulicsGraphEdge[]} */
  const path = [];
  let current = leafId;
  while (current !== 'boiler') {
    const edge = parentEdge.get(current);
    if (!edge) return [];
    path.unshift(edge);
    current = edge.from;
  }
  return path;
}

/**
 * @param {import('./types.js').HydraulicsGraphNode} node
 * @returns {import('./types.js').HydraulicsCirculationCircuitKind}
 */
function resolveCircuitKind(node) {
  if (node.kind === 'radiator_consumer' || node.kind === 'radiator_manifold') {
    return 'radiators';
  }
  if (node.kind === 'ufh_loop') return 'underfloor';
  if (node.kind === 'indirect_coil') return 'indirect_dhw';
  return 'dhw';
}

/**
 * @param {import('./types.js').HydraulicsGraphEdge[]} pathEdges
 * @param {Map<string, import('./types.js').HydraulicsPipeMatchItem>} pipeByEdge
 * @returns {number}
 */
function sumPathPressureDropKPa(pathEdges, pipeByEdge) {
  let oneWayKPa = 0;
  for (const edge of pathEdges) {
    oneWayKPa += pipeByEdge.get(edge.id)?.pressureDropKPa ?? 0;
  }
  return round(oneWayKPa * 2, 2);
}

/**
 * @param {object} args
 * @param {import('./types.js').HydraulicsGraph} args.graph
 * @param {import('./types.js').HydraulicsPipeMatchItem[]} args.pipes
 * @param {number} args.balancingValveKPaPerTurn
 * @returns {import('./types.js').HydraulicsCirculationLoopsReport}
 */
export function computeCirculationLoops({ graph, pipes, balancingValveKPaPerTurn }) {
  const pipeByEdge = new Map(pipes.map((p) => [p.edgeId, p]));
  const leaves = findLeafNodes(graph).filter((n) =>
    LEAF_NODE_KINDS.includes(n.kind),
  );

  /** @type {import('./types.js').HydraulicsCirculationLoopBranch[]} */
  const branches = [];

  for (const leaf of leaves) {
    const pathEdges = tracePathFromBoiler(graph, leaf.id);
    if (!pathEdges.length) continue;

    const pressureDropKPa = sumPathPressureDropKPa(pathEdges, pipeByEdge);
    branches.push({
      branchId: leaf.id,
      label: leaf.label,
      circuit: resolveCircuitKind(leaf),
      ...(leaf.roomId !== undefined ? { roomId: leaf.roomId } : {}),
      ...(leaf.loopId !== undefined ? { loopId: leaf.loopId } : {}),
      edgeIds: pathEdges.map((e) => e.id),
      pressureDropKPa,
      isCritical: false,
    });
  }

  branches.sort((a, b) => b.pressureDropKPa - a.pressureDropKPa);

  /** @type {import('./types.js').HydraulicsCirculationLoopBranch | null} */
  let criticalLoop = branches[0] ?? null;
  if (criticalLoop) {
    criticalLoop = { ...criticalLoop, isCritical: true };
    branches[0] = criticalLoop;
  }

  const criticalKPa = criticalLoop?.pressureDropKPa ?? 0;

  /** @type {import('./types.js').HydraulicsBalancingRecommendation[]} */
  const balancingRecommendations = [];

  for (const branch of branches) {
    if (branch.isCritical) continue;
    const excessKPa = round(criticalKPa - branch.pressureDropKPa, 2);
    if (excessKPa < 0.5) continue;

    const turns =
      balancingValveKPaPerTurn > 0
        ? Math.max(1, Math.round(excessKPa / balancingValveKPaPerTurn))
        : null;

    balancingRecommendations.push({
      branchId: branch.branchId,
      label: branch.label,
      circuit: branch.circuit,
      branchPressureDropKPa: branch.pressureDropKPa,
      criticalPressureDropKPa: criticalKPa,
      excessPressureDropKPa: excessKPa,
      ...(turns != null ? { estimatedValveTurns: turns } : {}),
      hint:
        turns != null
          ? `Прикрутить балансировочный клапан примерно на ${turns} обор. (избыток Δp ${excessKPa} кПа относительно критического контура).`
          : `Добавить сопротивление ${excessKPa} кПа балансировочным клапаном относительно критического контура.`,
    });
  }

  return {
    branches,
    criticalLoop,
    criticalLoopEdgeIds: criticalLoop?.edgeIds ?? [],
    criticalPressureDropKPa: criticalKPa,
    headRequiredM: round(criticalKPa / 9.81, 2),
    balancingRecommendations,
  };
}
