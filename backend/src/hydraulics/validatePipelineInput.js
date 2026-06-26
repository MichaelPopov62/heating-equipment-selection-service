/**
 * Назначение: AJV-валидация HydraulicsPipelineInput.
 * Описание: JSON Schema + cross-validation режимов контуров.
 */

import Ajv from 'ajv';
import { crossValidateHydraulicsPipelineInput } from './crossValidatePipelineInput.js';
import { loadHydraulicsPipelineSchemaForAjv } from './pipelineSchemaLoader.js';

/** @type {import('ajv').ValidateFunction | null} */
let validateFn = null;

/**
 * @returns {Promise<import('ajv').ValidateFunction>}
 */
async function getValidator() {
  if (validateFn) return validateFn;
  const schema = await loadHydraulicsPipelineSchemaForAjv();
  const ajv = new Ajv({ allErrors: true, strict: false });
  validateFn = ajv.compile(schema);
  return validateFn;
}

/**
 * @param {import('./types').HydraulicsPipelineInput} dto
 * @returns {Promise<void>}
 */
export async function validateHydraulicsPipelineInput(dto) {
  const validate = await getValidator();
  if (!validate(dto)) {
    const err = new Error('HydraulicsPipelineInput validation failed');
    err.code = 'HYDRAULICS_PIPELINE_INPUT_INVALID';
    err.details = validate.errors ?? [];
    throw err;
  }
  crossValidateHydraulicsPipelineInput(dto);
}

/**
 * @param {import('ajv').ValidateFunction | null} fn
 */
export function resetHydraulicsPipelineValidatorForTests(fn = null) {
  validateFn = fn;
}
