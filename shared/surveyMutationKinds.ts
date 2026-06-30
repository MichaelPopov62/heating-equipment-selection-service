/**
 * Назначение: коды мутаций анкеты (SSOT для frontend и документации).
 */

/** Типы событий единого pipeline анкеты. */
export const SURVEY_MUTATION_KINDS = [
  'SET_CURRENT_STEP',
  'SET_OBJECT_META',
  'SET_ROOMS',
  'SET_TEMPS',
  'SET_HOT_WATER_FORM',
  'SET_WATER_HEATER_FORM',
  'HEATING_EMITTERS_MODE_SET',
  'WATER_UFH_FLAG_SET',
  'UFH_DISTRIBUTION_PRESET_SET',
  'WIRING_SCHEME_SET',
  'SET_THERMAL_REGIME_PRESET',
  'SET_HYDRAULICS_FORM',
  'DRAFT_LOADED',
  'RUN_CALC_MANUAL',
] as const;

export type SurveyMutationKind = (typeof SURVEY_MUTATION_KINDS)[number];
