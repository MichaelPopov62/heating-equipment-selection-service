/**
 * Назначение: типы справочника underfloor_heating_presets.
 * Описание: Нормализованный bundle для configCache и validate.
 */

export interface UfhPresetTechnical {
  hasMixingNode: boolean;
  requiresCondensingBoiler: boolean;
  maxSupplyTemperatureC: number;
  maxSurfaceTemperatureC: number;
  /** Производное: maxSupply - 10 K */
  supplyC: number;
  /** Производное: supplyC - 10 */
  returnC: number;
}

export interface UfhPresetUi {
  title: string;
  badge: string;
  description: string;
}

export interface NormalizedUfhModePreset {
  presetId: string;
  technical: UfhPresetTechnical;
  ui: UfhPresetUi;
}

export interface UnderfloorHeatingPresetsBundle {
  schemaVersion: number;
  presets: NormalizedUfhModePreset[];
  byPresetId: Record<string, NormalizedUfhModePreset>;
}
