/**
 * Назначение: идентификаторы режимов тёплого пола (Mongo underfloor_heating_presets).
 * Описание: Технические presetId для API и calc; подписи UI — в коллекции ui.*.
 */

export const UFH_MODE_PRESET_IDS = Object.freeze([
  'ufh_only',
  'ufh_mixed_radiators',
  'ufh_direct_tile',
  'ufh_direct_laminate',
]);

/**
 * @param {string | undefined | null} id
 * @returns {boolean}
 */
export function isUfhModePresetId(id) {
  return typeof id === 'string' && UFH_MODE_PRESET_IDS.includes(id);
}

/** Режим «только ТП» без радиаторов. */
export const UFH_PRESET_ONLY = 'ufh_only';

/** Смешанный режим: ТП в выбранных комнатах + радиаторы (остаточная нагрузка). */
export const UFH_PRESET_MIXED_RADIATORS = 'ufh_mixed_radiators';

/** Прямое подключение под плитку (45/35). */
export const UFH_PRESET_DIRECT_TILE = 'ufh_direct_tile';

/** Прямое подключение под ламинат (40/30). */
export const UFH_PRESET_DIRECT_LAMINATE = 'ufh_direct_laminate';

/**
 * Пресеты, где контур ТП фиксируется technical пресета (не по финишу комнаты).
 *
 * @param {string | undefined | null} presetId
 * @returns {boolean}
 */
export function ufhModePresetOverridesFinishCircuit(presetId) {
  return (
    presetId === UFH_PRESET_DIRECT_TILE || presetId === UFH_PRESET_DIRECT_LAMINATE
  );
}

/**
 * Режим смешанных излучателей (радиаторы + ТП без дублирования нагрузки).
 *
 * @param {string | undefined | null} presetId
 * @returns {boolean}
 */
export function ufhModePresetIsMixedRadiators(presetId) {
  return (
    presetId === UFH_PRESET_MIXED_RADIATORS
    || presetId === UFH_PRESET_DIRECT_TILE
    || presetId === UFH_PRESET_DIRECT_LAMINATE
  );
}
