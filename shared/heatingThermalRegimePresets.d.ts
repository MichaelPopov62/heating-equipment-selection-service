/**
 * Назначение: типы пресетов температурного графика отопления.
 * Описание: Декларации для heatingThermalRegimePresets.js — ключи пресетов, enum и функции выбора по схеме ГВС.
 */
export type HeatingThermalRegimePreset =
  | 'traditional_high_dt70_95_85'
  | 'traditional_dt50_75_65'
  | 'condensing_dt30_55_45';

export declare const HEATING_THERMAL_REGIME_PRESETS: Readonly<{
  readonly traditional_high_dt70_95_85: {
    readonly supplyC: 95;
    readonly returnC: 85;
    readonly defaultRadiatorReferenceDeltaT: 70;
  };
  readonly traditional_dt50_75_65: {
    readonly supplyC: 75;
    readonly returnC: 65;
    readonly defaultRadiatorReferenceDeltaT: 50;
  };
  readonly condensing_dt30_55_45: {
    readonly supplyC: 55;
    readonly returnC: 45;
    readonly defaultRadiatorReferenceDeltaT: 50;
  };
}>;

export declare const HEATING_THERMAL_REGIME_PRESET_ENUM: readonly HeatingThermalRegimePreset[];

export declare const DEPRECATED_HEATING_THERMAL_REGIME_PRESETS: readonly HeatingThermalRegimePreset[];

export declare const HEATING_THERMAL_REGIME_UI_OPTIONS: readonly {
  value: HeatingThermalRegimePreset;
  label: string;
}[];

/** Варианты select анкеты без устаревших пресетов (95/85). */
export declare const HEATING_THERMAL_REGIME_SURVEY_UI_OPTIONS: readonly {
  value: HeatingThermalRegimePreset;
  label: string;
}[];

export declare function isDeprecatedHeatingThermalRegimePreset(
  presetId: string | undefined | null,
): boolean;

export declare function defaultThermalRegimePresetForObjectType(
  objectType: 'apartment' | 'house' | string | undefined,
): HeatingThermalRegimePreset;

export declare function isLowTemperatureThermalRegimePreset(
  presetId: string | undefined | null,
): boolean;

export declare function defaultThermalRegimePresetForMatchingScheme(
  scheme: string | undefined,
  objectType: 'apartment' | 'house' | string | undefined,
): HeatingThermalRegimePreset;
