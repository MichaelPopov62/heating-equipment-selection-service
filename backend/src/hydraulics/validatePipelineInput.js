/**
 * Назначение: AJV-валидация HydraulicsPipelineInput.
 * Описание: JSON Schema + cross-validation режимов контуров.
 */

import AjvImport from 'ajv';
import { crossValidateHydraulicsPipelineInput } from './crossValidatePipelineInput.js';
import { loadHydraulicsPipelineSchemaForAjv } from './pipelineSchemaLoader.js';

/** @type {typeof import('ajv').default} */
const Ajv = /** @type {typeof import('ajv').default} */ (
  /** @type {unknown} */ (AjvImport)
);

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
 * @param {import('./types.js').HydraulicsPipelineInput} dto
 * @returns {Promise<void>}
 */
export async function validateHydraulicsPipelineInput(dto) {
  const validate = await getValidator();
  if (!validate(dto)) {
    const err = new Error('HydraulicsPipelineInput validation failed');
    /** @type {Error & import('../types/shared-types.js').AppErrorLike} */
    const appErr = err;
    appErr.code = 'HYDRAULICS_PIPELINE_INPUT_INVALID';
    appErr.details = /** @type {import('../types/shared-types.js').ErrorDetailsAjvItem[]} */ (
      validate.errors ?? []
    );
    throw appErr;
  }
  crossValidateHydraulicsPipelineInput(dto);
}

/**
 * @param {import('ajv').ValidateFunction | null} [fn]
 */
export function resetHydraulicsPipelineValidatorForTests(fn = null) {
  validateFn = fn;
}
