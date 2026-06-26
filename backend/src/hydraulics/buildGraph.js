/**
 * Назначение: построение топологического графа из HydraulicsPipelineInput.
 * Описание: radiators_only, ufh_only, mixed — узлы и рёбра без подбора диаметров.
 */

/**
 * @param {import('./types').HydraulicsPipelineInput} dto
 * @returns {import('./types').HydraulicsGraph}
 */
export function buildHydraulicsGraph(dto) {
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

  if (needsSeparator) {
    pushNode('hydraulic_separator', 'hydraulic_separator', 'Гидрострелка');
    edges.push({
      id: 'e_boiler_separator',
      from: upstreamId,
      to: 'hydraulic_separator',
      lengthM: dto.layout.mainLineLengthM,
      fluid: 'heating',
      designFlowM3PerHour: resolvePrimaryFlowM3h(dto),
      supplyC: dto.source.supplyC,
      returnC: dto.source.returnC,
      segmentRole: 'main',
    });
    upstreamId = 'hydraulic_separator';
  } else if (needsMixingNode) {
    pushNode('mixing_node', 'mixing_node', 'Насосно-смесительный узел');
    edges.push({
      id: 'e_boiler_mixing',
      from: upstreamId,
      to: 'mixing_node',
      lengthM: dto.layout.mainLineLengthM,
      fluid: 'heating',
      designFlowM3PerHour: resolvePrimaryFlowM3h(dto),
      supplyC: dto.source.supplyC,
      returnC: dto.source.returnC,
      segmentRole: 'main',
    });
    upstreamId = 'mixing_node';
  } else if (dto.layout.mainLineLengthM > 0 || mode !== 'ufh_only') {
    pushNode('main_collector', 'main_collector', 'Магистраль / коллектор');
    edges.push({
      id: 'e_boiler_main',
      from: upstreamId,
      to: 'main_collector',
      lengthM: dto.layout.mainLineLengthM,
      fluid: 'heating',
      designFlowM3PerHour: resolvePrimaryFlowM3h(dto),
      supplyC: dto.source.supplyC,
      returnC: dto.source.returnC,
      segmentRole: 'main',
    });
    upstreamId = 'main_collector';
  }

  if (rad?.consumers?.length && mode !== 'ufh_only') {
    for (const consumer of rad.consumers) {
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
  }

  if (ufh?.rooms?.length && mode !== 'radiators_only') {
    const ufhCollectorId = 'ufh_collector';
    if (!nodes.some((n) => n.id === ufhCollectorId)) {
      pushNode(ufhCollectorId, 'ufh_collector', 'Коллектор ТП');
    }

    if (upstreamId !== ufhCollectorId) {
      edges.push({
        id: `e_${upstreamId}_to_ufh_collector`,
        from: upstreamId,
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

  return { nodes, edges };
}

/**
 * @param {import('./types').HydraulicsPipelineInput} dto
 * @returns {number}
 */
function resolvePrimaryFlowM3h(dto) {
  const rad = dto.circuits.radiators?.totalFlowRateM3PerHour ?? 0;
  const ufh = dto.circuits.underfloor?.aggregate.flowRateM3PerHour ?? 0;
  if (dto.meta.heatingEmittersMode === 'ufh_only') return ufh;
  if (dto.meta.heatingEmittersMode === 'radiators_only') return rad;
  return Math.max(rad, ufh);
}
