/**
 * Назначение: типы пресетов контура ТП.
 * Описание: Декларации для ufhCircuitPresets.js.
 */

export type UfhCircuitPresetId = 'ufh_dt10_45_35' | 'ufh_dt10_40_30';

export interface UfhCircuitPresetConfig {
  readonly id: UfhCircuitPresetId;
  readonly supplyC: number;
  readonly returnC: number;
  readonly deltaTK: number;
  readonly finishMaterialIds: readonly string[];
  readonly label: string;
}

export declare const UFH_CIRCUIT_PRESET_IDS: readonly UfhCircuitPresetId[];

export declare const UFH_CIRCUIT_PRESETS: Readonly<
  Record<UfhCircuitPresetId, UfhCircuitPresetConfig>
>;

export declare function isUfhCircuitPresetId(
  presetId: string | undefined | null,
): presetId is UfhCircuitPresetId;

export declare function getUfhCircuitPresetById(
  presetId: UfhCircuitPresetId,
): UfhCircuitPresetConfig;

export declare function resolveUfhCircuitPresetForFinishMaterialId(
  finishMaterialId: string | undefined | null,
): UfhCircuitPresetConfig | null;
