/**
 * Назначение: хелперы построения радиаторного подграфа.
 * Описание: порядок consumers, длины веток и сегментов магистрали.
 */

import { round } from '../utils/math.js';

/** @type {string} */
export const RAD_DISTRIBUTION_MANIFOLD_NODE_ID = 'rad_distribution_manifold';

/**
 * @param {number} index
 * @returns {string}
 */
export function radiatorTrunkJunctionNodeId(index) {
  return `rad_trunk_j_${index}`;
}

/**
 * @param {string} roomId
 * @returns {string}
 */
export function radiatorConsumerNodeId(roomId) {
  return `rad_${roomId}`;
}

/**
 * @param {import('./types').HydraulicsPipelineInput} dto
 * @returns {import('./types').HydraulicsRadiatorConsumer[]}
 */
export function orderRadiatorConsumers(dto) {
  const consumers = dto.circuits.radiators?.consumers ?? [];
  if (!consumers.length) return [];

  /** @type {Map<string, number>} */
  const orderIndex = new Map();
  for (let i = 0; i < dto.layout.radiatorBranches.length; i += 1) {
    orderIndex.set(dto.layout.radiatorBranches[i].roomId, i);
  }

  return [...consumers].sort((a, b) => {
    const ai = orderIndex.get(a.roomId);
    const bi = orderIndex.get(b.roomId);
    if (ai != null && bi != null) return ai - bi;
    if (ai != null) return -1;
    if (bi != null) return 1;
    return a.floor - b.floor || a.roomId.localeCompare(b.roomId);
  });
}

/**
 * @param {number} totalLengthM
 * @param {number} segmentCount
 * @returns {number}
 */
export function splitMainLineIntoTrunkSegments(totalLengthM, segmentCount) {
  if (segmentCount <= 0) return 0;
  return round(Math.max(0, totalLengthM) / segmentCount, 1);
}

/**
 * @param {string} roomId
 * @param {import('./types').HydraulicsPipelineInput} dto
 * @returns {number}
 */
export function resolveBranchLengthM(roomId, dto) {
  const branch = dto.layout.radiatorBranches.find((b) => b.roomId === roomId);
  return (
    branch?.pipeLengthToEquipmentM
    ?? dto.rules.defaultLengthsM.radiatorBranch
  );
}

/**
 * @param {import('./types').HydraulicsRadiatorsCircuit} rad
 * @returns {{ supplyC: number; returnC: number }}
 */
export function radiatorThermalRegime(rad) {
  return {
    supplyC: rad.thermalRegime.supplyC,
    returnC: rad.thermalRegime.returnC,
  };
}

/**
 * @param {import('./types').HydraulicsRadiatorConsumer[]} consumers
 * @param {number} fromIndex
 * @returns {number}
 */
export function sumConsumerFlowsFromIndex(consumers, fromIndex) {
  const sum = consumers
    .slice(fromIndex)
    .reduce((s, c) => s + c.flowRateM3PerHour, 0);
  return round(sum, 3);
}
