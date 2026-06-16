/**
 * Назначение: пресеты температурного графика отопления для backend и frontend.
 * Описание: Единый источник supply/return и defaultRadiatorReferenceDeltaT; выбор графика по схеме подбора котла.
 */

import { recommendedThermalRegimePresetForScheme } from './heatingThermalRegimeRecommendations.js';

export {
  allowedThermalRegimePresetsForScheme,
  recommendedThermalRegimePresetForScheme,
  thermalRegimeRecommendationHint,
  SURVEY_THERMAL_REGIME_PRESET_IDS,
} from './heatingThermalRegimeRecommendations.js';

/** @type {Record<string, { supplyC: number, returnC: number, defaultRadiatorReferenceDeltaT: 50 | 70 }>} */
const HEATING_THERMAL_REGIME_PRESETS_CONFIG = Object.freeze({
  /** Традиционный котёл, «высокий» график (типично ΔT_mean ≈ 70 K при 20 °C в помещении). */
  traditional_high_dt70_95_85: {
    supplyC: 95,
    returnC: 85,
    defaultRadiatorReferenceDeltaT: 70,
  },
  /** Традиционный / турбированный стандартный режим (ΔT_mean ≈ 50 K при 20 °C). */
  traditional_dt50_75_65: {
    supplyC: 75,
    returnC: 65,
    defaultRadiatorReferenceDeltaT: 50,
  },
  /** Конденсационный котёл, низкотемпературный контур (ΔT_mean ≈ 30 K при 20 °C). */
  condensing_dt30_55_45: {
    supplyC: 55,
    returnC: 45,
    defaultRadiatorReferenceDeltaT: 50,
  },
});

/** Устаревшие пресеты — только обратная совместимость API, не в анкете UI. */
export const DEPRECATED_HEATING_THERMAL_REGIME_PRESETS = Object.freeze([
  'traditional_high_dt70_95_85',
]);

/** Подписи для выпадающих списков UI — ключи совпадают с HEATING_THERMAL_REGIME_PRESETS. */
const HEATING_THERMAL_REGIME_UI_LABELS = Object.freeze({
  traditional_high_dt70_95_85:
    'Устаревший: 95/85 °C (только API, не для массового рынка)',
  traditional_dt50_75_65:
    'Традиционный котёл (газ/электро): 75/65 °C — базовый для радиаторов',
  condensing_dt30_55_45:
    'Конденсационный котёл: 55/45 °C — низкотемпературный радиаторный режим',
});

export const HEATING_THERMAL_REGIME_PRESETS = HEATING_THERMAL_REGIME_PRESETS_CONFIG;

/** Значения для AJV enum. */
export const HEATING_THERMAL_REGIME_PRESET_ENUM = Object.freeze(
  Object.keys(HEATING_THERMAL_REGIME_PRESETS),
);

/** Все пресеты (включая устаревшие) — для документации и API. */
export const HEATING_THERMAL_REGIME_UI_OPTIONS = Object.freeze(
  HEATING_THERMAL_REGIME_PRESET_ENUM.map((value) => ({
    value,
    label: HEATING_THERMAL_REGIME_UI_LABELS[value],
  })),
);

/** Варианты для select анкеты — без устаревших 95/85. */
export const HEATING_THERMAL_REGIME_SURVEY_UI_OPTIONS = Object.freeze(
  HEATING_THERMAL_REGIME_PRESET_ENUM.filter(
    (value) => !DEPRECATED_HEATING_THERMAL_REGIME_PRESETS.includes(value),
  ).map((value) => ({
    value,
    label: HEATING_THERMAL_REGIME_UI_LABELS[value],
  })),
);

/**
 * Пресет устарел для массового рынка (анкета UI).
 * @param {string | undefined | null} presetId
 * @returns {boolean}
 */
export function isDeprecatedHeatingThermalRegimePreset(presetId) {
  return (
    typeof presetId === 'string'
    && DEPRECATED_HEATING_THERMAL_REGIME_PRESETS.includes(presetId)
  );
}

/**
 * Пресет по умолчанию для типа объекта (квартира — низкотемпературный график под конденсацию).
 * @param {'apartment' | 'house' | string | undefined} objectType
 * @returns {keyof typeof HEATING_THERMAL_REGIME_PRESETS_CONFIG}
 */
export function defaultThermalRegimePresetForObjectType(objectType) {
  return objectType === 'apartment'
    ? 'condensing_dt30_55_45'
    : 'traditional_dt50_75_65';
}

/**
 * Явно выбранный низкотемпературный (конденсационный) график.
 * @param {string | undefined | null} presetId
 * @returns {boolean}
 */
export function isLowTemperatureThermalRegimePreset(presetId) {
  return presetId === 'condensing_dt30_55_45';
}

/**
 * Рекомендуемый пресет графика для схемы подбора котла (подсказка UI, не lock).
 * @param {string | undefined} scheme heatingSystem.hotWaterBoilerPowerMatchingScheme
 * @param {'apartment' | 'house' | string | undefined} objectType
 * @returns {keyof typeof HEATING_THERMAL_REGIME_PRESETS_CONFIG}
 */
export function defaultThermalRegimePresetForMatchingScheme(scheme, objectType) {
  return recommendedThermalRegimePresetForScheme(scheme, objectType);
}
