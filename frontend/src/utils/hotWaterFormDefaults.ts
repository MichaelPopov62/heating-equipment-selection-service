/**
 * Назначение: Значения по умолчанию формы ГВС.
 * Описание: Единая точка инициализации HotWaterFormValue и fixtures.
 */

import type { HotWaterFormFixtures, HotWaterFormValue } from '../types/hotWater';

/** Канонический порядок ключей точек водоразбора (SSOT). */
export const HOT_WATER_FIXTURE_KEYS = [
  'shower',
  'bath',
  'sink',
  'toilet',
  'kitchenSink',
  'dishwasher',
  'laundrySink',
  'washingMachine',
  'bidet',
] as const satisfies ReadonlyArray<keyof HotWaterFormFixtures>;

/** Ключи точек с вкладом в пиковый расход ГВ (без унитаза). */
export const HOT_WATER_THERMAL_FIXTURE_KEYS = [
  'shower',
  'bath',
  'sink',
  'kitchenSink',
  'dishwasher',
  'laundrySink',
  'washingMachine',
  'bidet',
] as const satisfies ReadonlyArray<keyof HotWaterFormFixtures>;

/** Нулевые точки водоразбора. */
export function createDefaultHotWaterFixtures(): HotWaterFormFixtures {
  return {
    shower: 0,
    bath: 0,
    sink: 0,
    toilet: 0,
    kitchenSink: 0,
    dishwasher: 0,
    laundrySink: 0,
    washingMachine: 0,
    bidet: 0,
  };
}

/** Начальное состояние шага «Горячая вода». */
export function createDefaultHotWaterFormValue(): HotWaterFormValue {
  return {
    residents: 0,
    coldWaterDesignSeason: 'winter',
    hotWaterC: 60,
    tropicalShower: false,
    fixtures: createDefaultHotWaterFixtures(),
  };
}
