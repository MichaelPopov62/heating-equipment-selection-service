/**
 * Назначение: идентификаторы режимов тёплого пола (Mongo underfloor_heating_presets).
 * Описание: Технические presetId для API и calc; подписи UI — в коллекции ui.*.
 */

export const UFH_MODE_PRESET_IDS = Object.freeze([
  'ufh_only',
  'ufh_mixed_radiators',
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

/**
 * Режим смешанных излучателей (радиаторы + ТП без дублирования нагрузки).
 *
 * @param {string | undefined | null} presetId
 * @returns {boolean}
 */
export function ufhModePresetIsMixedRadiators(presetId) {
  return presetId === UFH_PRESET_MIXED_RADIATORS;
}
