/**
 * Назначение: выбор входа CalcInput для POST /api/v1/projects/:id/calc.
 * Описание: calcInput → корневой CalcInput (без survey/calcInput) → lastCalcInput проекта.
 */

import { isPlainObject } from '../utils/isPlainObject.js';
import { assertCalcInputJsonSize } from './documentSizeLimits.js';
import { throwAppError } from '../utils/createAppError.js';

/** @typedef {'calcInput' | 'body' | 'lastCalcInput'} ProjectCalcInputSource */

/**
 * @param {unknown} value
 */
function assertCalcInputLike(value) {
  if (!isPlainObject(value)) {
    throwAppError('Вход расчёта должен быть объектом CalcInput.', 'CALC_INPUT_REQUIRED', 400);
  }
  const building = value.building;
  if (!isPlainObject(building)) {
    throwAppError(
      'Нет входа для расчёта: передайте calcInput или building, либо выполните первый расчёт с полным CalcInput.',
      'CALC_INPUT_REQUIRED',
      400,
    );
  }
}

/**
 * @param {Record<string, unknown>} value
 * @returns {import('../types/shared-types.js').CalcRequestBody}
 */
function asCalcRequestBody(value) {
  return /** @type {import('../types/shared-types.js').CalcRequestBody} */ (
    /** @type {unknown} */ (value)
  );
}

/**
 * Разрешает payload для validateAndNormalizeInput.
 *
 * @param {unknown} body — тело POST .../projects/:id/calc
 * @param {unknown} lastCalcInput — project.lastCalcInput из MongoDB
 * @returns {{ payload: import('../types/shared-types.js').CalcRequestBody, source: ProjectCalcInputSource }}
 */
export function resolveProjectCalcInput(body, lastCalcInput) {
  const requestBody = isPlainObject(body) ? body : {};

  if (requestBody.calcInput !== undefined && requestBody.calcInput !== null) {
    assertCalcInputLike(requestBody.calcInput);
    assertCalcInputJsonSize(requestBody.calcInput);
    return {
      payload: asCalcRequestBody(
        /** @type {Record<string, unknown>} */ (requestBody.calcInput),
      ),
      source: 'calcInput',
    };
  }

  if (isPlainObject(requestBody.building)) {
    const { survey: _survey, calcInput: _calcInput, ...calcOnly } = requestBody;
    assertCalcInputLike(calcOnly);
    assertCalcInputJsonSize(calcOnly);
    return {
      payload: asCalcRequestBody(calcOnly),
      source: 'body',
    };
  }

  if (isPlainObject(lastCalcInput)) {
    assertCalcInputLike(lastCalcInput);
    assertCalcInputJsonSize(lastCalcInput);
    return {
      payload: structuredClone(asCalcRequestBody(lastCalcInput)),
      source: 'lastCalcInput',
    };
  }

  throwAppError(
    'Нет входа для расчёта: передайте calcInput или building, либо выполните первый расчёт с полным CalcInput.',
    'CALC_INPUT_REQUIRED',
    400,
  );
}
