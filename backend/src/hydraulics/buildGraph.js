/**
 * Назначение: построение топологического графа из HydraulicsPipelineInput.
 * Описание: radiators_only, ufh_only, mixed — узлы и рёбра без подбора диаметров.
 */

import {
  resolveCirculationFlows,
  resolvePrimaryMainLineFlowM3h,
} from './resolveCirculationFlows.js';
import { thermalLoadToFlow } from './thermalLoadToFlow.js';
import {
  buildMicroManifoldLabel,
  partitionRadiatorConsumersForGraph,
  RAD_MICRO_MANIFOLD_NODE_ID,
  resolveMicroManifoldEdgeLength,
  sumMicroConsumersFlowM3h,
} from './groupRadiatorGraphBranches.js';

/**
 * @param {import('./types').HydraulicsPipelineInput} dto
 * @returns {import('./types').HydraulicsGraph}
 */
export function buildHydraulicsGraph(dto) {
  const flowCtx = resolveCirculationFlows(dto);

  /** @type {import('./types').HydraulicsGraphNode[]} */
  const nodes = [];
  /** @type {import('./types').HydraulicsGraphEdge[]} */
  const edges = [];

  const pushNode = (id, kind, label, extra = {}) => {
    nodes.push({ id, kind, label, ...extra });
  };

  pushNode('boiler', 'boiler', 'Котёл');
  let upstreamId = 'boiler';

  const mode = dto.meta.heatingEmittersMode;
  const ufh = dto.circuits.underfloor;
  const rad = dto.circuits.radiators;

  const needsSeparator =
    ufh?.isMixingNodeRequired
    && ufh.distributionPreset === 'hydraulic_separator';
  const needsMixingNode =
    ufh?.isMixingNodeRequired
    && ufh.distributionPreset === 'collector_mixing_valve';

  const primaryMainFlow = resolvePrimaryMainLineFlowM3h(dto);

  if (needsSeparator) {
    pushNode('hydraulic_separator', 'hydraulic_separator', 'Гидрострелка');
    edges.push({
      id: 'e_boiler_separator',
      from: upstreamId,
      to: 'hydraulic_separator',
      lengthM: dto.layout.mainLineLengthM,
      fluid: 'heating',
      designFlowM3PerHour: primaryMainFlow,
      supplyC: dto.source.supplyC,
      returnC: dto.source.returnC,
      segmentRole: 'main',
      isMainLine: true,
    });
    upstreamId = 'hydraulic_separator';
  } else if (
    dto.layout.mainLineLengthM > 0
    || mode !== 'ufh_only'
    || needsMixingNode
  ) {
    pushNode('main_collector', 'main_collector', 'Магистраль / коллектор');
    edges.push({
      id: 'e_boiler_main',
      from: upstreamId,
      to: 'main_collector',
      lengthM: dto.layout.mainLineLengthM,
      fluid: 'heating',
      designFlowM3PerHour: primaryMainFlow,
      supplyC: dto.source.supplyC,
      returnC: dto.source.returnC,
      segmentRole: 'main',
      isMainLine: true,
    });
    upstreamId = 'main_collector';
  }

  if (rad?.consumers?.length && mode !== 'ufh_only') {
    const { individual, microConsumers } = partitionRadiatorConsumersForGraph({
      consumers: rad.consumers,
      grouping: dto.rules.radiatorBranchGrouping,
    });

    for (const consumer of individual) {
      const nodeId = `rad_${consumer.roomId}`;
      pushNode(nodeId, 'radiator_consumer', consumer.roomName, {
        roomId: consumer.roomId,
      });
      const branch = dto.layout.radiatorBranches.find(
        (b) => b.roomId === consumer.roomId,
      );
      edges.push({
        id: `e_${upstreamId}_to_${nodeId}`,
        from: upstreamId,
        to: nodeId,
        lengthM: branch?.estimatedLengthM ?? dto.rules.defaultLengthsM.radiatorBranch,
        fluid: 'heating',
        designFlowM3PerHour: consumer.flowRateM3PerHour,
        supplyC: rad.thermalRegime.supplyC,
        returnC: rad.thermalRegime.returnC,
        segmentRole: 'branch',
      });
    }

    if (microConsumers.length > 0) {
      const roomIds = microConsumers.map((c) => c.roomId);
      pushNode(RAD_MICRO_MANIFOLD_NODE_ID, 'radiator_manifold', buildMicroManifoldLabel(microConsumers), {
        roomIds,
      });
      edges.push({
        id: `e_${upstreamId}_to_${RAD_MICRO_MANIFOLD_NODE_ID}`,
        from: upstreamId,
        to: RAD_MICRO_MANIFOLD_NODE_ID,
        lengthM: resolveMicroManifoldEdgeLength({
          microConsumers,
          branches: dto.layout.radiatorBranches,
          defaultBranchLengthM: dto.rules.defaultLengthsM.radiatorBranch,
          manifoldTrunkLengthM: dto.rules.radiatorBranchGrouping.manifoldTrunkLengthM,
        }),
        fluid: 'heating',
        designFlowM3PerHour: sumMicroConsumersFlowM3h(microConsumers),
        supplyC: rad.thermalRegime.supplyC,
        returnC: rad.thermalRegime.returnC,
        segmentRole: 'branch',
      });
    }
  }

  if (ufh?.rooms?.length && mode !== 'radiators_only') {
    const ufhCollectorId = 'ufh_collector';
    if (!nodes.some((n) => n.id === ufhCollectorId)) {
      pushNode(ufhCollectorId, 'ufh_collector', 'Коллектор ТП');
    }

    let ufhUpstreamId = upstreamId;

    if (needsMixingNode) {
      if (!nodes.some((n) => n.id === 'mixing_node')) {
        pushNode('mixing_node', 'mixing_node', 'Насосно-смесительный узел');
      }
      edges.push({
        id: 'e_main_to_mixing',
        from: upstreamId,
        to: 'mixing_node',
        lengthM: dto.rules.defaultLengthsM.ufhCollectorBranch,
        fluid: 'heating',
        designFlowM3PerHour: flowCtx.mixingNodePrimaryBleedM3PerHour,
        supplyC: dto.source.supplyC,
        returnC: dto.source.returnC,
        segmentRole: 'main',
        isMainLine: true,
      });
      ufhUpstreamId = 'mixing_node';
    }

    if (ufhUpstreamId !== ufhCollectorId) {
      edges.push({
        id: `e_${ufhUpstreamId}_to_ufh_collector`,
        from: ufhUpstreamId,
        to: ufhCollectorId,
        lengthM: dto.rules.defaultLengthsM.ufhCollectorBranch,
        fluid: 'heating',
        designFlowM3PerHour: ufh.aggregate.flowRateM3PerHour,
        supplyC: ufh.rooms[0]?.circuitSupplyC,
        returnC: ufh.rooms[0]?.circuitReturnC,
        segmentRole: 'main',
      });
    }

    for (const room of ufh.rooms) {
      const loops = room.loops?.length
        ? room.loops
        : [{
            loopId: `${room.roomId}_loop_1`,
            estimatedLengthM: dto.rules.defaultLengthsM.ufhCollectorBranch * 2,
            heatLoadWatts: room.heatLoadWatts,
            flowRateM3PerHour: room.flowRateM3PerHour,
          }];

      for (const loop of loops) {
        const loopNodeId = `ufh_loop_${loop.loopId}`;
        pushNode(loopNodeId, 'ufh_loop', `${room.roomName} — ${loop.loopId}`, {
          roomId: room.roomId,
          loopId: loop.loopId,
        });
        const branch = dto.layout.ufhBranches.find((b) => b.roomId === room.roomId);
        const supplyLen =
          (branch?.estimatedLengthM ?? dto.rules.defaultLengthsM.ufhCollectorBranch)
          + loop.estimatedLengthM;
        edges.push({
          id: `e_ufh_collector_to_${loop.loopId}`,
          from: ufhCollectorId,
          to: loopNodeId,
          lengthM: supplyLen,
          fluid: 'heating',
          designFlowM3PerHour: loop.flowRateM3PerHour,
          supplyC: room.circuitSupplyC,
          returnC: room.circuitReturnC,
          segmentRole: 'ufh_loop',
          ...(loop.catalogPipeId ? { preferredCatalogPipeId: loop.catalogPipeId } : {}),
        });
      }
    }
  }

  const dhw = dto.circuits.dhw;
  if (dhw && dhw.peakFlowLps > 0 && dhw.scenario === 'flowThrough') {
    pushNode('dhw_load', 'dhw_load', 'Пиковая нагрузка ГВС');
    const flowM3h = (dhw.peakFlowLps * 3600) / 1000;
    edges.push({
      id: 'e_boiler_dhw',
      from: 'boiler',
      to: 'dhw_load',
      lengthM: dto.rules.defaultLengthsM.radiatorBranch,
      fluid: 'water',
      designFlowM3PerHour: Math.round(flowM3h * 1000) / 1000,
      segmentRole: 'dhw',
    });
  }

  if (
    dhw?.indirectTank
    && dhw.hotWaterPowerKw > 0
    && dhw.scenario === 'storage'
  ) {
    const coilNodeId = 'indirect_coil';
    pushNode(coilNodeId, 'indirect_coil', 'Змеевик БКН');
    const coilFlow = thermalLoadToFlow({
      heatLoadWatts: dhw.hotWaterPowerKw * 1000,
      deltaTK: dto.source.deltaTK,
    });
    edges.push({
      id: 'e_boiler_indirect_coil',
      from: upstreamId,
      to: coilNodeId,
      lengthM: dto.rules.defaultLengthsM.radiatorBranch * 2,
      fluid: 'heating',
      designFlowM3PerHour: coilFlow.flowRateM3PerHour,
      supplyC: dto.source.supplyC,
      returnC: dto.source.returnC,
      segmentRole: 'branch',
    });
  }

  return { nodes, edges };
}
