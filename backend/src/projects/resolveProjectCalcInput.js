/**
 * Назначение: выбор входа CalcInput для POST /api/v1/projects/:id/calc.
 * Описание: calcInput → корневой CalcInput (без survey/calcInput) → lastCalcInput проекта.
 */

import { isPlainObject } from '../utils/isPlainObject.js';
import { assertCalcInputJsonSize } from './documentSizeLimits.js';

/** @typedef {'calcInput' | 'body' | 'lastCalcInput'} ProjectCalcInputSource */

/**
 * @param {unknown} value
 */
function assertCalcInputLike(value) {
  if (!isPlainObject(value)) {
    const err = new Error('Вход расчёта должен быть объектом CalcInput.');
    err.statusCode = 400;
    err.code = 'CALC_INPUT_REQUIRED';
    throw err;
  }
  const building = value.building;
  if (!isPlainObject(building)) {
    const err = new Error(
      'Нет входа для расчёта: передайте calcInput или building, либо выполните первый расчёт с полным CalcInput.',
    );
    err.statusCode = 400;
    err.code = 'CALC_INPUT_REQUIRED';
    throw err;
  }
}

/**
 * Разрешает payload для validateAndNormalizeInput.
 *
 * @param {unknown} body — тело POST .../projects/:id/calc
 * @param {unknown} lastCalcInput — project.lastCalcInput из MongoDB
 * @returns {{ payload: import('../types/shared-types').CalcRequestBody, source: ProjectCalcInputSource }}
 */
export function resolveProjectCalcInput(body, lastCalcInput) {
  const requestBody = isPlainObject(body) ? body : {};

  if (requestBody.calcInput !== undefined && requestBody.calcInput !== null) {
    assertCalcInputLike(requestBody.calcInput);
    assertCalcInputJsonSize(requestBody.calcInput);
    return {
      payload: /** @type {import('../types/shared-types').CalcRequestBody} */ (
        requestBody.calcInput
      ),
      source: 'calcInput',
    };
  }

  if (isPlainObject(requestBody.building)) {
    const { survey: _survey, calcInput: _calcInput, ...calcOnly } = requestBody;
    assertCalcInputLike(calcOnly);
    assertCalcInputJsonSize(calcOnly);
    return {
      payload: /** @type {import('../types/shared-types').CalcRequestBody} */ (calcOnly),
      source: 'body',
    };
  }

  if (isPlainObject(lastCalcInput)) {
    assertCalcInputLike(lastCalcInput);
    assertCalcInputJsonSize(lastCalcInput);
    return {
      payload: structuredClone(
        /** @type {import('../types/shared-types').CalcRequestBody} */ (lastCalcInput),
      ),
      source: 'lastCalcInput',
    };
  }

  const err = new Error(
    'Нет входа для расчёта: передайте calcInput или building, либо выполните первый расчёт с полным CalcInput.',
  );
  err.statusCode = 400;
  err.code = 'CALC_INPUT_REQUIRED';
  throw err;
}
