/**
 * Назначение: Локальная валидация формы водонагревателя.
 * Описание: Предупреждения без блокировки API — стратегические подсказки пользователю.
 */

import type { ObjectType } from '../types/envelope';
import type { HotWaterFormValue } from '../types/hotWater';
import {
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
  type HotWaterBoilerPowerMatchingScheme,
} from '../types/heatingMatching';
import type { WaterHeaterFormValue } from '../types/waterHeater';
import { countThermalFixtures } from './countThermalFixtures';

export type WaterHeaterFormValidation = {
  /** Блокирующих ошибок нет — только подсказки. */
  warnings: string[];
};

/**
 * Проверяет согласованность стратегии ГВС с типом объекта и потреблением.
 *
 * @param value — форма водонагревателя
 * @param context — контекст анкеты (не входит в payload формы)
 */
export function validateWaterHeaterForm(
  value: WaterHeaterFormValue,
  context: {
    objectType: ObjectType;
    hotWaterForm: HotWaterFormValue;
    allowedSchemes: HotWaterBoilerPowerMatchingScheme[];
  },
): WaterHeaterFormValidation {
  const warnings: string[] = [];
  const { objectType, hotWaterForm, allowedSchemes } = context;
  const scheme = value.hotWaterBoilerPowerMatchingScheme;

  if (!allowedSchemes.includes(scheme)) {
    warnings.push(
      'Выбранная схема недоступна для текущего типа объекта — будет подставлена схема по умолчанию.',
    );
  }

  if (
    objectType === 'apartment' &&
    scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM &&
    !value.indirectDhwSpaceAvailable
  ) {
    warnings.push(
      'Для схемы «1К + БКН» в квартире отметьте наличие места под бойлер — иначе подбор БКН не выполнится.',
    );
  }

  if (
    countThermalFixtures(hotWaterForm.fixtures) === 0
    && hotWaterForm.residents === 0
  ) {
    warnings.push(
      'На шаге «Горячая вода» не заданы жильцы и точки водоразбора — расчёт объёма и мощности ГВС может быть некорректным.',
    );
  }

  return { warnings };
}
