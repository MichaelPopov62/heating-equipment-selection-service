/**
 * Назначение: Значения по умолчанию формы водонагревателя.
 * Описание: Единая точка инициализации WaterHeaterFormValue.
 */

import { SCHEME_BOILER_MAX_COMBI } from '../types/heatingMatching';
import type { WaterHeaterFormValue } from '../types/waterHeater';

/** Начальное состояние шага «Водонагреватель». */
export function createDefaultWaterHeaterFormValue(): WaterHeaterFormValue {
  return {
    hotWaterBoilerPowerMatchingScheme: SCHEME_BOILER_MAX_COMBI,
    indirectDhwSpaceAvailable: false,
  };
}
