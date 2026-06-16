/**
 * Назначение: пресеты схемы распределения ТП (НСУ / гидрострелка).
 * Описание: Общий справочник для backend и frontend.
 */

/** @typedef {'auto' | 'collector_mixing_valve' | 'hydraulic_separator'} UfhDistributionPreset */

/** @type {readonly UfhDistributionPreset[]} */
export const UFH_DISTRIBUTION_PRESET_IDS = Object.freeze([
  'auto',
  'collector_mixing_valve',
  'hydraulic_separator',
]);

/** @type {Readonly<Record<UfhDistributionPreset, string>>} */
export const UFH_DISTRIBUTION_PRESET_LABELS = Object.freeze({
  auto: 'Авто по масштабу объекта',
  collector_mixing_valve: 'Насосно-смесительный узел на коллекторе',
  hydraulic_separator: 'Гидравлическая стрелка + зональные контуры',
});

/** Варианты для select анкеты. */
export const UFH_DISTRIBUTION_UI_OPTIONS = Object.freeze(
  UFH_DISTRIBUTION_PRESET_IDS.map((value) => ({
    value,
    label: UFH_DISTRIBUTION_PRESET_LABELS[value],
  })),
);

/**
 * @param {string | undefined | null} value
 * @returns {value is UfhDistributionPreset}
 */
export function isUfhDistributionPreset(value) {
  return (
    typeof value === 'string'
    && UFH_DISTRIBUTION_PRESET_IDS.includes(/** @type {UfhDistributionPreset} */ (value))
  );
}

/**
 * @typedef {object} UfhDistributionAutoRules
 * @property {number} [autoHydraulicSeparatorMinBoilerKw]
 * @property {number} [autoHydraulicSeparatorMinRoomsCount]
 */

/**
 * Автовыбор схемы при mixed-контуре (без номенклатуры насосов).
 *
 * @param {object} ctx
 * @param {'apartment' | 'house' | string | undefined} ctx.objectType
 * @param {number} [ctx.roomsWithUfhCount]
 * @param {number} [ctx.requiredBoilerKw]
 * @param {UfhDistributionAutoRules} [ctx.autoRules] — из appliances.underfloor_heating.distribution
 * @returns {Exclude<UfhDistributionPreset, 'auto'>}
 */
export function resolveAutoUfhDistributionPreset(ctx) {
  const { objectType, roomsWithUfhCount = 0, requiredBoilerKw, autoRules } = ctx;
  const minBoilerKw = autoRules?.autoHydraulicSeparatorMinBoilerKw ?? 50;
  const minRooms = autoRules?.autoHydraulicSeparatorMinRoomsCount ?? 7;

  if (typeof requiredBoilerKw === 'number' && requiredBoilerKw > minBoilerKw) {
    return 'hydraulic_separator';
  }
  if (objectType === 'apartment') {
    return 'collector_mixing_valve';
  }
  if (roomsWithUfhCount >= minRooms) {
    return 'hydraulic_separator';
  }
  return 'collector_mixing_valve';
}

/**
 * @param {UfhDistributionPreset | undefined | null} requested
 * @param {object} ctx — см. resolveAutoUfhDistributionPreset
 * @returns {Exclude<UfhDistributionPreset, 'auto'>}
 */
export function resolveUfhDistributionPreset(requested, ctx) {
  if (requested === 'collector_mixing_valve' || requested === 'hydraulic_separator') {
    return requested;
  }
  return resolveAutoUfhDistributionPreset(ctx);
}
