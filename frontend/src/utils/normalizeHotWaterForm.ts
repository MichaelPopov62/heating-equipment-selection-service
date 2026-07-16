/**
 * Назначение: Нормализация HotWaterFormValue / fixtures.
 * Описание: Единый вход из черновика, мутаций и payload calc — все ключи числом ≥ 0.
 */

import type { HotWaterFormFixtures, HotWaterFormValue } from '../types/hotWater';
import { isRecord } from './jsonGuards';
import {
  createDefaultHotWaterFormValue,
  createDefaultHotWaterFixtures,
  HOT_WATER_FIXTURE_KEYS,
} from './hotWaterFormDefaults';

const FIXTURE_MAX = 30;
const RESIDENTS_MAX = 20;
const HOT_WATER_C_MIN = 55;
const HOT_WATER_C_MAX = 60;

/**
 * Целое в диапазоне [min, max]; иначе min.
 *
 * @param value
 * @param min
 * @param max
 */
function clampInt(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

/**
 * Температура ГВ °C в [55, 60]; иначе defaultC.
 *
 * @param value
 * @param defaultC
 */
function clampHotWaterC(value: unknown, defaultC: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return defaultC;
  return Math.max(HOT_WATER_C_MIN, Math.min(HOT_WATER_C_MAX, value));
}

/**
 * Приводит произвольный объект к полному HotWaterFormFixtures без NaN/undefined.
 *
 * @param raw
 */
export function normalizeHotWaterFixtures(raw: unknown): HotWaterFormFixtures {
  const defaults = createDefaultHotWaterFixtures();
  if (!isRecord(raw)) return defaults;

  const next = { ...defaults };
  for (const key of HOT_WATER_FIXTURE_KEYS) {
    next[key] = clampInt(raw[key], 0, FIXTURE_MAX);
  }
  return next;
}

/**
 * Приводит произвольный объект к HotWaterFormValue.
 *
 * @param raw
 */
export function normalizeHotWaterForm(raw: unknown): HotWaterFormValue {
  const defaults = createDefaultHotWaterFormValue();
  if (!isRecord(raw)) return defaults;

  const seasonRaw = raw.coldWaterDesignSeason;
  const coldWaterDesignSeason =
    seasonRaw === 'summer' || seasonRaw === 'winter'
      ? seasonRaw
      : defaults.coldWaterDesignSeason;

  return {
    residents: clampInt(raw.residents, 0, RESIDENTS_MAX),
    coldWaterDesignSeason,
    hotWaterC: clampHotWaterC(raw.hotWaterC, defaults.hotWaterC),
    tropicalShower: raw.tropicalShower === true,
    fixtures: normalizeHotWaterFixtures(raw.fixtures),
  };
}
