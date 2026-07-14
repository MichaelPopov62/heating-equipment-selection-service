/**
 * Назначение: фабрика топологий радиаторного подграфа.
 * Описание: auto (звезда), dead-end, pass-through, manifold — по layout.radiatorWiringSystemType.
 */

import {
  buildMicroManifoldLabel,
  partitionRadiatorConsumersForGraph,
  RAD_MICRO_MANIFOLD_NODE_ID,
  resolveMicroManifoldEdgeLength,
  sumMicroConsumersFlowM3h,
} from './groupRadiatorGraphBranches.js';
import {
  orderRadiatorConsumers,
  RAD_DISTRIBUTION_MANIFOLD_NODE_ID,
  radiatorConsumerNodeId,
  radiatorThermalRegime,
  radiatorTrunkJunctionNodeId,
  resolveBranchLengthM,
  splitMainLineIntoTrunkSegments,
  sumConsumerFlowsFromIndex,
} from './radiatorGraphHelpers.js';

/**
 * @typedef {object} RadiatorSubgraphContext
 * @property {string} upstreamId
 * @property {import('./types.js').HydraulicsPipelineInput} dto
 * @property {(id: string, kind: import('./types.js').HydraulicsNodeKind, label: string, extra?: object) => void} pushNode
 * @property {(edge: import('./types.js').HydraulicsGraphEdge) => void} pushEdge
 */

/**
 * @param {RadiatorSubgraphContext} ctx
 */
function buildStarRadiatorGraph(ctx) {
  const rad = ctx.dto.circuits.radiators;
  if (!rad?.consumers?.length) return;

  const upstreamId = ctx.upstreamId;
  const { individual, microConsumers } = partitionRadiatorConsumersForGraph({
    consumers: rad.consumers,
    grouping: ctx.dto.rules.radiatorBranchGrouping,
  });

  for (const consumer of individual) {
    const nodeId = radiatorConsumerNodeId(consumer.roomId);
    ctx.pushNode(nodeId, 'radiator_consumer', consumer.roomName, {
      roomId: consumer.roomId,
    });
    const thermal = radiatorThermalRegime(rad);
    const branch = ctx.dto.layout.radiatorBranches.find(
      (b) => b.roomId === consumer.roomId,
    );
    ctx.pushEdge({
      id: `e_${upstreamId}_to_${nodeId}`,
      from: upstreamId,
      to: nodeId,
      lengthM: branch?.pipeLengthToEquipmentM ?? ctx.dto.rules.defaultLengthsM.radiatorBranch,
      fluid: 'heating',
      designFlowM3PerHour: consumer.flowRateM3PerHour,
      supplyC: thermal.supplyC,
      returnC: thermal.returnC,
      segmentRole: 'branch',
    });
  }

  if (microConsumers.length > 0) {
    const roomIds = microConsumers.map((c) => c.roomId);
    ctx.pushNode(
      RAD_MICRO_MANIFOLD_NODE_ID,
      'radiator_manifold',
      buildMicroManifoldLabel(microConsumers),
      { roomIds },
    );
    const thermal = radiatorThermalRegime(rad);
    ctx.pushEdge({
      id: `e_${upstreamId}_to_${RAD_MICRO_MANIFOLD_NODE_ID}`,
      from: upstreamId,
      to: RAD_MICRO_MANIFOLD_NODE_ID,
      lengthM: resolveMicroManifoldEdgeLength({
        microConsumers,
        branches: ctx.dto.layout.radiatorBranches,
        defaultBranchLengthM: ctx.dto.rules.defaultLengthsM.radiatorBranch,
        manifoldTrunkLengthM: ctx.dto.rules.radiatorBranchGrouping.manifoldTrunkLengthM,
      }),
      fluid: 'heating',
      designFlowM3PerHour: sumMicroConsumersFlowM3h(microConsumers),
      supplyC: thermal.supplyC,
      returnC: thermal.returnC,
      segmentRole: 'branch',
    });
  }
}

/**
 * @param {RadiatorSubgraphContext} ctx
 * @param {'dead_end' | 'pass_through'} mode
 */
function buildSequentialRadiatorGraph(ctx, mode) {
  const rad = ctx.dto.circuits.radiators;
  if (!rad?.consumers?.length) return;

  const consumers = orderRadiatorConsumers(ctx.dto).filter(
    (c) => c.heatLoadWatts > 0 && c.flowRateM3PerHour > 0,
  );
  if (!consumers.length) return;

  const thermal = radiatorThermalRegime(rad);
  const totalFlow = rad.totalFlowRateM3PerHour;
  const trunkLen = splitMainLineIntoTrunkSegments(
    ctx.dto.layout.mainLineLengthM,
    Math.max(consumers.length - 1, 1),
  );

  if (consumers.length === 1) {
    const consumer = consumers[0];
    if (!consumer) return;
    const nodeId = radiatorConsumerNodeId(consumer.roomId);
    ctx.pushNode(nodeId, 'radiator_consumer', consumer.roomName, {
      roomId: consumer.roomId,
    });
    ctx.pushEdge({
      id: `e_${ctx.upstreamId}_to_${nodeId}`,
      from: ctx.upstreamId,
      to: nodeId,
      lengthM: resolveBranchLengthM(consumer.roomId, ctx.dto),
      fluid: 'heating',
      designFlowM3PerHour: consumer.flowRateM3PerHour,
      supplyC: thermal.supplyC,
      returnC: thermal.returnC,
      segmentRole: 'branch',
      teeRole: 'branch_takeoff',
    });
    return;
  }

  for (let i = 0; i < consumers.length; i += 1) {
    const junctionId = radiatorTrunkJunctionNodeId(i);
    ctx.pushNode(junctionId, 'radiator_trunk_junction', `Тройник ${i + 1}`, {});

    const consumer = consumers[i];
    if (!consumer) continue;
    const radNodeId = radiatorConsumerNodeId(consumer.roomId);
    ctx.pushNode(radNodeId, 'radiator_consumer', consumer.roomName, {
      roomId: consumer.roomId,
    });

    const fromId = i === 0 ? ctx.upstreamId : radiatorTrunkJunctionNodeId(i - 1);
    if (i === 0) {
      ctx.pushEdge({
        id: `e_${fromId}_to_${junctionId}`,
        from: fromId,
        to: junctionId,
        lengthM: 0,
        fluid: 'heating',
        designFlowM3PerHour:
          mode === 'pass_through'
            ? totalFlow
            : sumConsumerFlowsFromIndex(consumers, 0),
        supplyC: thermal.supplyC,
        returnC: thermal.returnC,
        segmentRole: 'branch',
      });
    }

    ctx.pushEdge({
      id: `e_${junctionId}_to_${radNodeId}`,
      from: junctionId,
      to: radNodeId,
      lengthM: resolveBranchLengthM(consumer.roomId, ctx.dto),
      fluid: 'heating',
      designFlowM3PerHour: consumer.flowRateM3PerHour,
      supplyC: thermal.supplyC,
      returnC: thermal.returnC,
      segmentRole: 'branch',
      teeRole: 'branch_takeoff',
    });

    if (i < consumers.length - 1) {
      const nextJunctionId = radiatorTrunkJunctionNodeId(i + 1);
      const trunkFlow =
        mode === 'pass_through'
          ? totalFlow
          : sumConsumerFlowsFromIndex(consumers, i + 1);
      ctx.pushEdge({
        id: `e_${junctionId}_to_${nextJunctionId}`,
        from: junctionId,
        to: nextJunctionId,
        lengthM: trunkLen,
        fluid: 'heating',
        designFlowM3PerHour: trunkFlow,
        supplyC: thermal.supplyC,
        returnC: thermal.returnC,
        segmentRole: 'trunk',
        teeRole: 'pass_through',
      });
    }
  }
}

/**
 * @param {RadiatorSubgraphContext} ctx
 */
function buildDeadEndRadiatorGraph(ctx) {
  buildSequentialRadiatorGraph(ctx, 'dead_end');
}

/**
 * @param {RadiatorSubgraphContext} ctx
 */
function buildPassThroughRadiatorGraph(ctx) {
  buildSequentialRadiatorGraph(ctx, 'pass_through');
}

/**
 * @param {RadiatorSubgraphContext} ctx
 */
function buildManifoldRadiatorGraph(ctx) {
  const rad = ctx.dto.circuits.radiators;
  if (!rad?.consumers?.length) return;

  const consumers = orderRadiatorConsumers(ctx.dto).filter(
    (c) => c.heatLoadWatts > 0 && c.flowRateM3PerHour > 0,
  );
  if (!consumers.length) return;

  const thermal = radiatorThermalRegime(rad);
  const upstreamId = ctx.upstreamId;

  ctx.pushNode(
    RAD_DISTRIBUTION_MANIFOLD_NODE_ID,
    'radiator_distribution_manifold',
    'Коллектор радиаторов',
    { roomIds: consumers.map((c) => c.roomId) },
  );

  ctx.pushEdge({
    id: `e_${upstreamId}_to_${RAD_DISTRIBUTION_MANIFOLD_NODE_ID}`,
    from: upstreamId,
    to: RAD_DISTRIBUTION_MANIFOLD_NODE_ID,
    lengthM: ctx.dto.rules.radiatorBranchGrouping.manifoldTrunkLengthM,
    fluid: 'heating',
    designFlowM3PerHour: rad.totalFlowRateM3PerHour,
    supplyC: thermal.supplyC,
    returnC: thermal.returnC,
    segmentRole: 'branch',
  });

  for (const consumer of consumers) {
    const nodeId = radiatorConsumerNodeId(consumer.roomId);
    ctx.pushNode(nodeId, 'radiator_consumer', consumer.roomName, {
      roomId: consumer.roomId,
    });
    ctx.pushEdge({
      id: `e_${RAD_DISTRIBUTION_MANIFOLD_NODE_ID}_to_${nodeId}`,
      from: RAD_DISTRIBUTION_MANIFOLD_NODE_ID,
      to: nodeId,
      lengthM: resolveBranchLengthM(consumer.roomId, ctx.dto),
      fluid: 'heating',
      designFlowM3PerHour: consumer.flowRateM3PerHour,
      supplyC: thermal.supplyC,
      returnC: thermal.returnC,
      segmentRole: 'branch',
    });
  }
}

/**
 * @param {RadiatorSubgraphContext} ctx
 */
export function buildRadiatorSubgraph(ctx) {
  const wiring = ctx.dto.layout.radiatorWiringSystemType ?? 'auto';
  switch (wiring) {
    case 'two-pipe-dead-end':
      buildDeadEndRadiatorGraph(ctx);
      break;
    case 'two-pipe-pass':
      buildPassThroughRadiatorGraph(ctx);
      break;
    case 'manifold':
      buildManifoldRadiatorGraph(ctx);
      break;
    default:
      buildStarRadiatorGraph(ctx);
  }
}
