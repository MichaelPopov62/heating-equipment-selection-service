/**
 * Назначение: cross-validation режима контуров HydraulicsPipelineInput.
 * Описание: Дополняет AJV — режим emitters vs наличие radiators/underfloor.
 */

/**
 * @param {import('./types').HydraulicsPipelineInput} dto
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
 * @returns {Error & { code: string; details: { instancePath: string; message: string }[] }}
 */
function validationError(message, path) {
  const err = new Error(message);
  err.code = 'HYDRAULICS_PIPELINE_INPUT_INVALID';
  err.details = [{ instancePath: `/${path.replace(/\./g, '/')}`, message }];
  return err;
}
