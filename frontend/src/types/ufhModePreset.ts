/**
 * Назначение: типы режимов ТП (Mongo underfloor_heating_presets).
 */

export type UfhModePresetId =
  | 'ufh_only'
  | 'ufh_mixed_radiators'
  | 'ufh_direct_tile'
  | 'ufh_direct_laminate';

export type UfhModePresetUi = {
  title: string;
  badge: string;
  description: string;
};

export type UfhModePresetCard = {
  presetId: UfhModePresetId;
  ui: UfhModePresetUi;
};

export type UfhModePresetsResponse = {
  ok: boolean;
  schemaVersion: number;
  source: 'file' | 'mongo';
  presets: UfhModePresetCard[];
};
