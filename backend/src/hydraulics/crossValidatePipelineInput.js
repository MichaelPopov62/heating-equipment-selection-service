/**
 * Назначение: cross-validation режима контуров HydraulicsPipelineInput.
 * Описание: Дополняет AJV — режим emitters vs наличие radiators/underfloor; согласованность Q.
 */

import { thermalLoadToFlow } from './thermalLoadToFlow.js';
import { round } from '../utils/math.js';

/**
 * @param {import('./types.js').HydraulicsPipelineInput} dto
 */
export function crossValidateHydraulicsPipelineInput(dto) {
  const mode = dto.meta.heatingEmittersMode;

  if (mode === 'ufh_only') {
    if (dto.circuits.radiators?.consumers?.length) {
      throw validationError(
        'ufh_only: контур radiators не должен присутствовать',
        'circuits.radiators',
      );
    }
    if (!dto.circuits.underfloor?.rooms?.length) {
      throw validationError(
        'ufh_only: обязателен circuits.underfloor.rooms',
        'circuits.underfloor',
      );
    }
  }

  if (mode === 'radiators_only' && dto.circuits.underfloor?.rooms?.length) {
    throw validationError(
      'radiators_only: circuits.underfloor не ожидается',
      'circuits.underfloor',
    );
  }

  if (mode === 'mixed') {
    const hasRad = (dto.circuits.radiators?.consumers?.length ?? 0) > 0;
    const hasUfh = (dto.circuits.underfloor?.rooms?.length ?? 0) > 0;
    if (!hasRad && !hasUfh) {
      throw validationError(
        'mixed: нужен хотя бы один контур radiators или underfloor',
        'circuits',
      );
    }
  }

  for (const c of dto.circuits.radiators?.consumers ?? []) {
    if (c.heatLoadWatts > 0 && !(c.flowRateM3PerHour > 0)) {
      throw validationError(
        `radiators consumer ${c.roomId}: flowRateM3PerHour обязателен при heatLoadWatts > 0`,
        `circuits.radiators.consumers`,
      );
    }
  }

  const radCircuit = dto.circuits.radiators;
  if (radCircuit?.consumers?.length && radCircuit.flowDeltaTK > 0) {
    const flowDt = radCircuit.flowDeltaTK;
    for (const c of radCircuit.consumers) {
      if (c.heatLoadWatts <= 0 || c.flowRateM3PerHour <= 0) continue;
      const expected = thermalLoadToFlow({
        heatLoadWatts: c.heatLoadWatts,
        deltaTK: flowDt,
      }).flowRateM3PerHour;
      const relErr = Math.abs(c.flowRateM3PerHour - expected) / expected;
      if (relErr > 0.02) {
        throw validationError(
          `radiators consumer ${c.roomId}: flowRateM3PerHour ${c.flowRateM3PerHour} не согласован с flowDeltaTK=${flowDt} (ожид. ≈${expected})`,
          'circuits.radiators.consumers',
        );
      }
    }
    const sumConsumers = round(
      radCircuit.consumers.reduce((s, c) => s + c.flowRateM3PerHour, 0),
      3,
    );
    if (
      radCircuit.totalFlowRateM3PerHour > 0
      && Math.abs(sumConsumers - radCircuit.totalFlowRateM3PerHour) > 0.002
    ) {
      throw validationError(
        `radiators totalFlowRateM3PerHour (${radCircuit.totalFlowRateM3PerHour}) ≠ sum(consumers) (${sumConsumers})`,
        'circuits.radiators.totalFlowRateM3PerHour',
      );
    }
  }

  for (const r of dto.circuits.underfloor?.rooms ?? []) {
    if (r.heatLoadWatts > 0 && !(r.flowRateM3PerHour > 0)) {
      throw validationError(
        `underfloor room ${r.roomId}: flowRateM3PerHour обязателен при heatLoadWatts > 0`,
        'circuits.underfloor.rooms',
      );
    }
  }
}

/**
 * @param {string} message
 * @param {string} path
 * @returns {Error & import('../types/shared-types.js').AppErrorLike}
 */
function validationError(message, path) {
  const err = new Error(message);
  /** @type {Error & import('../types/shared-types.js').AppErrorLike} */
  const appErr = err;
  appErr.code = 'HYDRAULICS_PIPELINE_INPUT_INVALID';
  appErr.details = [{ instancePath: `/${path.replace(/\./g, '/')}`, message }];
  return appErr;
}
