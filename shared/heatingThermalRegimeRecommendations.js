/**
 * Назначение: рекомендации температурного графика радиаторов (без блокировки выбора).
 * Описание: Единая матрица для дома и квартиры; схема котла/ГВС задаёт подсказку, не lock.
 */

import {
  SCHEME_BOILER_COMBI_BUFFER_ELECTRIC,
  SCHEME_BOILER_ELECTRIC_SEPARATE,
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
} from './heatingMatchingSchemes.js';

/** Допустимые пресеты радиаторного графика в анкете (без устаревших 95/85). */
export const SURVEY_THERMAL_REGIME_PRESET_IDS = Object.freeze([
  'traditional_dt50_75_65',
  'condensing_dt30_55_45',
]);

/** Схемы с двухконтурным котлом — рекомендуем низкотемпературный график, но допустимы оба. */
const DOUBLE_CIRCUIT_MATCHING_SCHEMES = new Set([
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_COMBI_BUFFER_ELECTRIC,
]);

/** Схемы с одноконтурным котлом — рекомендуем 75/65, допустим и 55/45 (в т.ч. 1К+БКН). */
const SINGLE_CIRCUIT_MATCHING_SCHEMES = new Set([
  SCHEME_BOILER_ELECTRIC_SEPARATE,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
  SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC,
]);

/**
 * Допустимые пресеты графика для схемы (все рабочие — оба варианта).
 * @param {string | undefined} scheme
 * @returns {readonly string[]}
 */
export function allowedThermalRegimePresetsForScheme(scheme) {
  void scheme;
  return SURVEY_THERMAL_REGIME_PRESET_IDS;
}

/**
 * Рекомендуемый пресет графика по схеме подбора котла и типу объекта.
 * Единая матрица для дома и квартиры: схема влияет на рекомендацию.
 *
 * @param {string | undefined} scheme heatingSystem.hotWaterBoilerPowerMatchingScheme
 * @param {'apartment' | 'house' | string | undefined} objectType
 * @returns {'traditional_dt50_75_65' | 'condensing_dt30_55_45'}
 */
export function recommendedThermalRegimePresetForScheme(scheme, objectType) {
  void objectType;
  if (typeof scheme === 'string' && DOUBLE_CIRCUIT_MATCHING_SCHEMES.has(scheme)) {
    return 'condensing_dt30_55_45';
  }
  if (typeof scheme === 'string' && SINGLE_CIRCUIT_MATCHING_SCHEMES.has(scheme)) {
    return 'traditional_dt50_75_65';
  }
  return objectType === 'apartment'
    ? 'condensing_dt30_55_45'
    : 'traditional_dt50_75_65';
}

/**
 * Текст подсказки для UI при расхождении выбора и рекомендации.
 *
 * @param {string | undefined} scheme
 * @param {'apartment' | 'house' | string | undefined} objectType
 * @param {string | undefined} selectedPreset
 * @returns {string | null}
 */
export function thermalRegimeRecommendationHint(scheme, objectType, selectedPreset) {
  const recommended = recommendedThermalRegimePresetForScheme(scheme, objectType);
  if (!selectedPreset || selectedPreset === recommended) return null;
  const recLabel =
    recommended === 'condensing_dt30_55_45' ? '55/45 °C' : '75/65 °C';
  const selLabel =
    selectedPreset === 'condensing_dt30_55_45' ? '55/45 °C' : '75/65 °C';
  return `Для выбранной схемы котла рекомендуем график ${recLabel} (сейчас ${selLabel}). Расчёт выполняется по вашему выбору.`;
}
