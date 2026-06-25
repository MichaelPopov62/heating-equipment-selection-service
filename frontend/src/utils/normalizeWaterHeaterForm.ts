/**
 * Назначение: Нормализация WaterHeaterFormValue из черновика/API.
 * Описание: Безопасный разбор partial-объекта с дефолтами.
 */

import {
  HOT_WATER_BOILER_MATCHING_SCHEME_ENUM,
  type HotWaterBoilerPowerMatchingScheme,
} from '../types/heatingMatching';
import type { WaterHeaterFormValue } from '../types/waterHeater';
import { createDefaultWaterHeaterFormValue } from './waterHeaterFormDefaults';
import { isRecord } from './jsonGuards';

const SCHEME_SET = new Set<string>(HOT_WATER_BOILER_MATCHING_SCHEME_ENUM);

function isMatchingScheme(v: unknown): v is HotWaterBoilerPowerMatchingScheme {
  return typeof v === 'string' && SCHEME_SET.has(v);
}

/**
 * Приводит произвольный объект к WaterHeaterFormValue.
 */
export function normalizeWaterHeaterForm(raw: unknown): WaterHeaterFormValue {
  const defaults = createDefaultWaterHeaterFormValue();
  if (!isRecord(raw)) return defaults;

  const schemeRaw = raw.hotWaterBoilerPowerMatchingScheme;
  return {
    hotWaterBoilerPowerMatchingScheme: isMatchingScheme(schemeRaw)
      ? schemeRaw
      : defaults.hotWaterBoilerPowerMatchingScheme,
    indirectDhwSpaceAvailable: raw.indirectDhwSpaceAvailable === true,
  };
}
