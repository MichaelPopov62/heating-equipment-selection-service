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
      'Обрана схема недоступна для поточного типу об\'єкта — буде підставлена схема за замовчуванням.',
    );
  }

  if (
    objectType === 'apartment' &&
    scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM &&
    !value.indirectDhwSpaceAvailable
  ) {
    warnings.push(
      'Для схеми «1К + БКН» у квартирі позначте наявність місця під бойлер — інакше підбір БКН не виконається.',
    );
  }

  if (
    countThermalFixtures(hotWaterForm.fixtures) === 0
    && hotWaterForm.residents === 0
  ) {
    warnings.push(
      'На кроці «Гаряча вода» не задані мешканці та точки водорозбору — розрахунок об\'єму та потужності ГВП може бути некоректним.',
    );
  }

  return { warnings };
}
