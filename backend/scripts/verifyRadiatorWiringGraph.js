/**
 * Назначение: verify топологий радиаторного подграфа (wiring types).
 * Запуск: npm run verify:radiator-wiring-graph (из backend/)
 */

import { buildHydraulicsGraph } from '../src/hydraulics/buildGraph.js';
import { RAD_DISTRIBUTION_MANIFOLD_NODE_ID } from '../src/hydraulics/radiatorGraphHelpers.js';

/**
 * @param {import('../src/hydraulics/types').HydraulicsPipelineInput} dto
 * @returns {import('../src/hydraulics/types').HydraulicsGraph}
 */
function buildGraphForDto(dto) {
  return buildHydraulicsGraph(dto);
}

/** @type {import('../src/hydraulics/types').HydraulicsRadiatorConsumer[]} */
const consumers = [
  { roomId: 'r1', roomName: 'R1', floor: 1, heatLoadWatts: 1200, flowRateM3PerHour: 0.052 },
  { roomId: 'r2', roomName: 'R2', floor: 1, heatLoadWatts: 900, flowRateM3PerHour: 0.039 },
  { roomId: 'r3', roomName: 'R3', floor: 1, heatLoadWatts: 700, flowRateM3PerHour: 0.03 },
];

/** @type {import('../src/hydraulics/types').HydraulicsRules} */
const rules = {
  mainTransitMinInternalDiameterMm: 20,
  branchMinInternalDiameterMm: 12,
  velocityLimitsMps: { mainMax: 0.8, branchMax: 0.5, mainMin: 0.2, branchMin: 0 },
  radiatorBranchGrouping: {
    minFlowM3PerHourForIndividualBranch: 0.019,
    minHeatLoadWattsForIndividualBranch: 150,
    manifoldTrunkLengthM: 2,
    localZetaManifold: 1.5,
  },
  defaultLengthsM: { mainLine: 8, radiatorBranch: 4, ufhCollectorBranch: 3 },
  maxUfhLoopLengthM: 100,
  roughnessMmByMaterial: { pex: 0.007 },
  localLossZeta: {
    elbow90: 0.9,
    teeBranch: 1.2,
    teePass: 0.6,
    teeBranchTakeoff: 1.2,
    mixingNode: 2.5,
    collector: 1.5,
  },
  pumpHeadMarginPercent: 12,
  pumpDutyQMaxUtilizationPercent: 85,
  pumpMinHeadAtDutyM: 0.3,
  pumpMaxHeadMarginPercent: 60,
  pumpMinHeadAtQMaxM: 0.5,
  primaryFlowMarginPercent: 12,
  balancingValveKPaPerTurn: 3,
};

/**
 * @param {import('../src/hydraulics/types').RadiatorWiringSystemType} wiringType
 * @returns {import('../src/hydraulics/types').HydraulicsPipelineInput}
 */
function baseDto(wiringType) {
  return {
    schemaVersion: 1,
    meta: {
      heatingEmittersMode: 'radiators_only',
      objectType: 'house',
      dhwMatchingScheme: 'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
    },
    source: {
      supplyC: 75,
      returnC: 65,
      deltaTK: 20,
      requiredKw: 12,
      connectionNominalMm: [25],
    },
    circuits: {
      radiators: {
        thermalRegime: { supplyC: 75, returnC: 65, deltaTK: 10 },
        flowDeltaTK: 20,
        connectionType: 'side',
        consumers,
        totalFlowRateM3PerHour: 0.121,
      },
    },
    layout: {
      mainLineLengthM: 9,
      radiatorWiringSystemType: wiringType,
      radiatorBranches: [
        { roomId: 'r1', pipeLengthToEquipmentM: 3 },
        { roomId: 'r2', pipeLengthToEquipmentM: 4 },
        { roomId: 'r3', pipeLengthToEquipmentM: 5 },
      ],
      ufhCollectorTransit: [],
    },
    rules,
  };
}

const deadEnd = buildGraphForDto(baseDto('two-pipe-dead-end'));
const deadEndTrunks = deadEnd.edges.filter((e) => e.segmentRole === 'trunk');
if (deadEndTrunks.length !== 2) {
  throw new Error(`dead-end: ожидалось 2 trunk, получено ${deadEndTrunks.length}`);
}
if (deadEndTrunks[0].designFlowM3PerHour < deadEndTrunks[1].designFlowM3PerHour) {
  throw new Error('dead-end: Q на trunk должен убывать вдоль магистрали');
}

const passGraph = buildGraphForDto(baseDto('two-pipe-pass'));
for (const edge of passGraph.edges.filter((e) => e.segmentRole === 'trunk')) {
  if (Math.abs(edge.designFlowM3PerHour - 0.121) > 0.001) {
    throw new Error(`pass: trunk ${edge.id} Q=${edge.designFlowM3PerHour} ≠ 0.121`);
  }
}

const manifoldGraph = buildGraphForDto(baseDto('manifold'));
const manifoldNode = manifoldGraph.nodes.find(
  (n) => n.kind === 'radiator_distribution_manifold',
);
if (!manifoldNode || manifoldNode.id !== RAD_DISTRIBUTION_MANIFOLD_NODE_ID) {
  throw new Error('manifold: нет rad_distribution_manifold');
}
const manifoldBranches = manifoldGraph.edges.filter(
  (e) => e.from === RAD_DISTRIBUTION_MANIFOLD_NODE_ID,
);
if (manifoldBranches.length !== 3) {
  throw new Error(`manifold: ожидалось 3 ветки, получено ${manifoldBranches.length}`);
}

const autoGraph = buildGraphForDto(baseDto('auto'));
if (!autoGraph.nodes.some((n) => n.kind === 'main_collector')) {
  throw new Error('auto: нет main_collector');
}

console.log('verify:radiator-wiring-graph — все кейсы прошли');
