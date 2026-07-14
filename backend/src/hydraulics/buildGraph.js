/**
 * Назначение: построение топологического графа из HydraulicsPipelineInput.
 * Описание: radiators_only, ufh_only, mixed — узлы и рёбра без подбора диаметров.
 */

import {
  resolveCirculationFlows,
  resolvePrimaryMainLineFlowM3h,
} from './resolveCirculationFlows.js';
import { thermalLoadToFlow } from './thermalLoadToFlow.js';
import { round } from '../utils/math.js';
import { buildRadiatorSubgraph } from './buildRadiatorSubgraph.js';

/**
 * @param {number} floor
 * @returns {string}
 */
function ufhCollectorNodeId(floor) {
  return `ufh_collector_floor_${floor}`;
}

/**
 * @param {import('./types.js').HydraulicsUfhRoom} room
 * @returns {import('./types.js').HydraulicsUfhLoop[]}
 */
function resolveRoomLoopsForGraph(room) {
  if (room.loops?.length) return room.loops;
  const spacingM = Math.max(0.05, (Number(room.pipeSpacingMm) || 150) / 1000);
  const area = Math.max(0, Number(room.areaM2) || 0);
  const loopLengthM = area > 0 ? round(area / spacingM, 1) : 0;
  return [{
    loopId: `${room.roomId}_loop_1`,
    loopLengthM,
    heatLoadWatts: room.heatLoadWatts,
    flowRateM3PerHour: room.flowRateM3PerHour,
  }];
}

/**
 * @param {import('./types.js').HydraulicsPipelineInput} dto
 * @returns {import('./types.js').HydraulicsGraph}
 */
export function buildHydraulicsGraph(dto) {
  const flowCtx = resolveCirculationFlows(dto);

  /** @type {import('./types.js').HydraulicsGraphNode[]} */
  const nodes = [];
  /** @type {import('./types.js').HydraulicsGraphEdge[]} */
  const edges = [];

  /**
   * @param {string} id
   * @param {import('./types.js').HydraulicsNodeKind} kind
   * @param {string} label
   * @param {Partial<Omit<import('./types.js').HydraulicsGraphNode, 'id' | 'kind' | 'label'>>} [extra]
   */
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
    buildRadiatorSubgraph({
      upstreamId,
      dto,
      pushNode,
      pushEdge: (edge) => edges.push(edge),
    });
  }

  if (ufh?.rooms?.length && mode !== 'radiators_only') {
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

    const transitByFloor = new Map(
      (dto.layout.ufhCollectorTransit ?? []).map((t) => [t.floor, t.transitLengthM]),
    );

    /** @type {Map<number, import('./types.js').HydraulicsUfhRoom[]>} */
    const roomsByFloor = new Map();
    for (const room of ufh.rooms) {
      const floor = room.floor ?? 1;
      const list = roomsByFloor.get(floor) ?? [];
      list.push(room);
      roomsByFloor.set(floor, list);
    }

    for (const floor of [...roomsByFloor.keys()].sort((a, b) => a - b)) {
      const floorRooms = roomsByFloor.get(floor) ?? [];
      const collectorRooms = floorRooms.filter(
        (r) => r.ufhTerminalControl !== 'unibox',
      );
      const uniboxRooms = floorRooms.filter(
        (r) => r.ufhTerminalControl === 'unibox',
      );

      if (collectorRooms.length > 0) {
        const collectorId = ufhCollectorNodeId(floor);
        if (!nodes.some((n) => n.id === collectorId)) {
          pushNode(collectorId, 'ufh_collector', `Коллектор ТП, этаж ${floor}`, {
            floor,
          });
        }

        const floorFlow = round(
          collectorRooms.reduce((s, r) => s + (r.flowRateM3PerHour ?? 0), 0),
          3,
        );
        const transitLengthM =
          transitByFloor.get(floor)
          ?? dto.rules.defaultLengthsM.ufhCollectorBranch;

        const firstRoom = collectorRooms[0];
        edges.push({
          id: `e_${ufhUpstreamId}_to_${collectorId}`,
          from: ufhUpstreamId,
          to: collectorId,
          lengthM: transitLengthM,
          fluid: 'heating',
          designFlowM3PerHour: floorFlow,
          ...(firstRoom?.circuitSupplyC !== undefined
            ? { supplyC: firstRoom.circuitSupplyC }
            : {}),
          ...(firstRoom?.circuitReturnC !== undefined
            ? { returnC: firstRoom.circuitReturnC }
            : {}),
          segmentRole: 'ufh_collector_transit',
        });

        for (const room of collectorRooms) {
          const loops = resolveRoomLoopsForGraph(room);
          for (const loop of loops) {
            const loopNodeId = `ufh_loop_${loop.loopId}`;
            pushNode(loopNodeId, 'ufh_loop', `${room.roomName} — ${loop.loopId}`, {
              roomId: room.roomId,
              loopId: loop.loopId,
            });
            edges.push({
              id: `e_${collectorId}_to_${loop.loopId}`,
              from: collectorId,
              to: loopNodeId,
              lengthM: loop.loopLengthM,
              fluid: 'heating',
              designFlowM3PerHour: loop.flowRateM3PerHour,
              supplyC: room.circuitSupplyC,
              returnC: room.circuitReturnC,
              segmentRole: 'ufh_loop',
              ...(loop.catalogPipeId
                ? { preferredCatalogPipeId: loop.catalogPipeId }
                : {}),
            });
          }
        }
      }

      for (const room of uniboxRooms) {
        const loops = resolveRoomLoopsForGraph(room);
        for (const loop of loops) {
          const loopNodeId = `ufh_loop_${loop.loopId}`;
          pushNode(loopNodeId, 'ufh_loop', `${room.roomName} — ${loop.loopId}`, {
            roomId: room.roomId,
            loopId: loop.loopId,
          });
          edges.push({
            id: `e_${ufhUpstreamId}_to_${loop.loopId}`,
            from: ufhUpstreamId,
            to: loopNodeId,
            lengthM: loop.loopLengthM,
            fluid: 'heating',
            designFlowM3PerHour: loop.flowRateM3PerHour,
            supplyC: room.circuitSupplyC,
            returnC: room.circuitReturnC,
            segmentRole: 'ufh_loop',
            ...(loop.catalogPipeId
              ? { preferredCatalogPipeId: loop.catalogPipeId }
              : {}),
          });
        }
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
