/**
 * Назначение: группировка микроветок радиаторов в графе гидравлики.
 * Описание: Комнаты с малым Q/P объединяются в узел rad_micro_manifold;
 * нулевая нагрузка не попадает в граф.
 */

import { round } from '../utils/math.js';

/** @type {string} */
export const RAD_MICRO_MANIFOLD_NODE_ID = 'rad_micro_manifold';

/**
 * @param {object} args
 * @param {import('./types').HydraulicsRadiatorConsumer[]} args.consumers
 * @param {import('./types').HydraulicsRadiatorBranchGrouping} args.grouping
 * @returns {{
 *   individual: import('./types').HydraulicsRadiatorConsumer[];
 *   microConsumers: import('./types').HydraulicsRadiatorConsumer[];
 * }}
 */
export function partitionRadiatorConsumersForGraph({ consumers, grouping }) {
  /** @type {import('./types').HydraulicsRadiatorConsumer[]} */
  const individual = [];
  /** @type {import('./types').HydraulicsRadiatorConsumer[]} */
  const microConsumers = [];

  const minFlow = grouping.minFlowM3PerHourForIndividualBranch;
  const minHeat = grouping.minHeatLoadWattsForIndividualBranch;

  for (const consumer of consumers) {
    if (consumer.heatLoadWatts <= 0 || consumer.flowRateM3PerHour <= 0) {
      continue;
    }
    const qualifiesIndividual =
      consumer.flowRateM3PerHour >= minFlow
      && consumer.heatLoadWatts >= minHeat;
    if (qualifiesIndividual) {
      individual.push(consumer);
    } else {
      microConsumers.push(consumer);
    }
  }

  return { individual, microConsumers };
}

/**
 * @param {import('./types').HydraulicsRadiatorConsumer[]} microConsumers
 * @returns {string}
 */
export function buildMicroManifoldLabel(microConsumers) {
  const names = microConsumers.map((c) => c.roomName).join(', ');
  return `Коллектор малых контуров (${microConsumers.length} комн.): ${names}`;
}

/**
 * @param {object} args
 * @param {import('./types').HydraulicsRadiatorConsumer[]} args.microConsumers
 * @param {import('./types').HydraulicsBranchLayout[]} args.branches
 * @param {number} args.defaultBranchLengthM
 * @param {number} args.manifoldTrunkLengthM
 * @returns {number}
 */
export function resolveMicroManifoldEdgeLength({
  microConsumers,
  branches,
  defaultBranchLengthM,
  manifoldTrunkLengthM,
}) {
  let maxBranchLen = 0;
  for (const consumer of microConsumers) {
    const branch = branches.find((b) => b.roomId === consumer.roomId);
    const len = branch?.estimatedLengthM ?? defaultBranchLengthM;
    maxBranchLen = Math.max(maxBranchLen, len);
  }
  return round(manifoldTrunkLengthM + maxBranchLen, 1);
}

/**
 * @param {import('./types').HydraulicsRadiatorConsumer[]} microConsumers
 * @returns {number}
 */
export function sumMicroConsumersFlowM3h(microConsumers) {
  const sum = microConsumers.reduce((s, c) => s + c.flowRateM3PerHour, 0);
  return round(sum, 3);
}
