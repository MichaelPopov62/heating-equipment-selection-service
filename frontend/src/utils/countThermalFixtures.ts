/**
 * Назначение: Сумма точек водоразбора с расходом ГВ (без унитаза).
 * Описание: SSOT для итогов; всегда через normalizeHotWaterFixtures — без NaN.
 */

import type { HotWaterFormFixtures } from '../types/hotWater';
import {
  HOT_WATER_THERMAL_FIXTURE_KEYS,
} from './hotWaterFormDefaults';
import { normalizeHotWaterFixtures } from './normalizeHotWaterForm';

/**
 * @param fixtures — анкета или partial; нормализуется перед суммой
 * @returns сумма точек с вкладом в пиковый расход ГВ
 */
export function countThermalFixtures(
  fixtures: HotWaterFormFixtures | null | undefined,
): number {
  const fx = normalizeHotWaterFixtures(fixtures);
  let sum = 0;
  for (const key of HOT_WATER_THERMAL_FIXTURE_KEYS) {
    sum += fx[key];
  }
  return sum;
}

/**
 * Есть ли хотя бы одна указанная точка (для показа блока в «Результатах»).
 *
 * @param fixtures
 */
export function hasHotWaterFixturesContent(
  fixtures: HotWaterFormFixtures | null | undefined,
): boolean {
  if (fixtures == null) return false;
  const fx = normalizeHotWaterFixtures(fixtures);
  return countThermalFixtures(fx) + fx.toilet > 0;
}
