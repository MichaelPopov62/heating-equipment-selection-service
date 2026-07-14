/**
 * Назначение: composition root calc-пайплайна для HTTP.
 * Описание: Единая точка bundle → ctx → validate → report для POST /api/v1/calc и POST /api/v1/projects/:id/calc.
 */

import { buildReport } from '../report/public.js';
import { getReferenceBundle, toCalcRuntimeContext } from '../reference/public.js';
import { validateAndNormalizeInput } from './validate.js';

/**
 * Загружает справочники, валидирует вход и строит отчёт расчёта.
 *
 * @param {unknown} rawBody — сырой CalcInput (до AJV)
 * @returns {Promise<import('../types/shared-types.js').IRunCalculationResult>}
 */
export async function runCalculation(rawBody) {
  const bundle = await getReferenceBundle();
  const ctx = toCalcRuntimeContext(bundle);
  const input = validateAndNormalizeInput(rawBody, ctx);
  const report = await buildReport({ input, ctx });
  return { input, report };
}
