/**
 * Назначение: типы рекомендаций температурного графика.
 * Описание: Декларации heatingThermalRegimeRecommendations.js.
 */
import type { HeatingThermalRegimePreset } from './heatingThermalRegimePresets.js';

export declare const SURVEY_THERMAL_REGIME_PRESET_IDS: readonly [
  'traditional_dt50_75_65',
  'condensing_dt30_55_45',
];

export declare function allowedThermalRegimePresetsForScheme(
  scheme: string | undefined,
): readonly string[];

export declare function recommendedThermalRegimePresetForScheme(
  scheme: string | undefined,
  objectType: 'apartment' | 'house' | string | undefined,
): 'traditional_dt50_75_65' | 'condensing_dt30_55_45';

export declare function thermalRegimeRecommendationHint(
  scheme: string | undefined,
  objectType: 'apartment' | 'house' | string | undefined,
  selectedPreset: string | undefined,
): string | null;

export type { HeatingThermalRegimePreset };
