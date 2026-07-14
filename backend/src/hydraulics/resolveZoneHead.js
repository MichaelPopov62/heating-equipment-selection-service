/**
 * Назначение: требуемый напор H по зоне циркуляции.
 * Описание: Критическое кольцо графа + минимумы смесительного узла ТП.
 */

import { round } from '../utils/math.js';

/**
 * @param {import('./types.js').HydraulicsCirculationLoopBranch[]} loops
 * @param {import('./types.js').HydraulicsCirculationCircuitKind} circuit
 * @returns {number}
 */
function maxHeadMForCircuit(loops, circuit) {
  const maxKPa = loops
    .filter((b) => b.circuit === circuit)
    .reduce((m, b) => Math.max(m, b.pressureDropKPa), 0);
  return maxKPa > 0 ? round(maxKPa / 9.81, 2) : 0;
}

/**
 * @param {string} zoneId
 * @param {import('./types.js').HydraulicsPressureReport} pressure
 * @param {import('./types.js').HydraulicsPipelineInput} dto
 * @returns {number}
 */
export function resolveHeadForZone(zoneId, pressure, dto) {
  const loops = pressure.circulationLoops ?? [];

  if (zoneId === 'ufh_floor' || zoneId === 'ufh_floor_secondary') {
    const mixingMin = dto.circuits.underfloor?.mixingNode?.headMetersMin ?? 0;
    const fromGraph = maxHeadMForCircuit(loops, 'underfloor');
    return Math.max(mixingMin, fromGraph, mixingMin > 0 ? mixingMin : fromGraph);
  }

  if (zoneId === 'radiators_secondary') {
    const fromGraph = maxHeadMForCircuit(loops, 'radiators');
    if (fromGraph > 0) return fromGraph;
  }

  return pressure.headRequiredM;
}
