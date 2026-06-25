/**
 * Назначение: Сборка objectMeta для POST /api/v1/calc.
 * Описание: Реэкспорт shared-контракта с типизацией для frontend.
 */

import { objectMetaForCalcPayload as objectMetaForCalcPayloadShared } from '../../../shared/waterHeaterFormContract.js';
import type { ObjectMetaValue } from '../types/envelope';
import type { WaterHeaterFormValue } from '../types/waterHeater';

/**
 * Формирует objectMeta для API: флаг БКН только при квартире + схема 1К+БКН + галочка.
 */
export function objectMetaForCalcPayload(
  objectMeta: ObjectMetaValue,
  waterHeaterForm: WaterHeaterFormValue,
): ObjectMetaValue {
  return objectMetaForCalcPayloadShared(
    objectMeta,
    waterHeaterForm,
  ) as ObjectMetaValue;
}
