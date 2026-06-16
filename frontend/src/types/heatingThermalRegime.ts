/**
 * Назначение: Типы теплового режима отопления.
 * Описание: Пресеты графика supply/return и рекомендации по схеме котла.
 */

export type { HeatingThermalRegimePreset } from '../../../shared/heatingThermalRegimePresets';
export {
  HEATING_THERMAL_REGIME_SURVEY_UI_OPTIONS as HEATING_THERMAL_REGIME_OPTIONS,
  defaultThermalRegimePresetForObjectType,
  defaultThermalRegimePresetForMatchingScheme,
  isLowTemperatureThermalRegimePreset,
  isDeprecatedHeatingThermalRegimePreset,
} from '../../../shared/heatingThermalRegimePresets.js';
export {
  recommendedThermalRegimePresetForScheme,
  thermalRegimeRecommendationHint,
} from '../../../shared/heatingThermalRegimeRecommendations.js';
