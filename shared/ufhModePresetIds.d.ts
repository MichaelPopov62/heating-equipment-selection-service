/**
 * Назначение: типы идентификаторов режимов тёплого пола.
 * Описание: Декларации для TypeScript рядом с ufhModePresetIds.js.
 */

export type UfhModePresetIdShared = 'ufh_only' | 'ufh_mixed_radiators';

export declare const UFH_MODE_PRESET_IDS: readonly UfhModePresetIdShared[];

export declare const UFH_PRESET_ONLY: 'ufh_only';

export declare const UFH_PRESET_MIXED_RADIATORS: 'ufh_mixed_radiators';

export declare function isUfhModePresetId(
  id: string | null | undefined,
): boolean;

export declare function ufhModePresetIsMixedRadiators(
  presetId: string | null | undefined,
): boolean;
