/**
 * Назначение: пресеты температурного графика контура водяного тёплого пола.
 * Описание: Отдельно от радиаторного heatingSystem.thermalRegimePreset; Δt = 10 K для обоих.
 */

/** @typedef {'ufh_dt10_45_35' | 'ufh_dt10_40_30'} UfhCircuitPresetId */

/** @type {readonly UfhCircuitPresetId[]} */
export const UFH_CIRCUIT_PRESET_IDS = Object.freeze([
  'ufh_dt10_45_35',
  'ufh_dt10_40_30',
]);

/** @type {Readonly<Record<UfhCircuitPresetId, { id: UfhCircuitPresetId, supplyC: number, returnC: number, deltaTK: number, finishMaterialIds: readonly string[], label: string }>>} */
export const UFH_CIRCUIT_PRESETS = Object.freeze({
  ufh_dt10_45_35: Object.freeze({
    id: 'ufh_dt10_45_35',
    supplyC: 45,
    returnC: 35,
    deltaTK: 10,
    finishMaterialIds: Object.freeze(['ceramic_tile']),
    label: '45/35 °C — плитка, керамогранит',
  }),
  ufh_dt10_40_30: Object.freeze({
    id: 'ufh_dt10_40_30',
    supplyC: 40,
    returnC: 30,
    deltaTK: 10,
    finishMaterialIds: Object.freeze(['pvc_glue', 'pvc_click', 'laminate_click']),
    label: '40/30 °C — ламинат, LVT/SPC, линолеум для ТП',
  }),
});

/**
 * @param {string | undefined | null} presetId
 * @returns {boolean}
 */
export function isUfhCircuitPresetId(presetId) {
  return (
    typeof presetId === 'string'
    && Object.prototype.hasOwnProperty.call(UFH_CIRCUIT_PRESETS, presetId)
  );
}

/**
 * @param {UfhCircuitPresetId} presetId
 * @returns {typeof UFH_CIRCUIT_PRESETS[UfhCircuitPresetId]}
 */
export function getUfhCircuitPresetById(presetId) {
  if (!isUfhCircuitPresetId(presetId)) {
    throw new Error(`Невідомий пресет контуру ТП: ${presetId}`);
  }
  return UFH_CIRCUIT_PRESETS[presetId];
}

/**
 * Пресет контура ТП по id финишного покрытия.
 * @param {string | undefined | null} finishMaterialId
 * @returns {typeof UFH_CIRCUIT_PRESETS[UfhCircuitPresetId] | null}
 */
export function resolveUfhCircuitPresetForFinishMaterialId(finishMaterialId) {
  if (!finishMaterialId) return null;
  for (const presetId of UFH_CIRCUIT_PRESET_IDS) {
    const preset = UFH_CIRCUIT_PRESETS[presetId];
    if (preset.finishMaterialIds.includes(finishMaterialId)) {
      return preset;
    }
  }
  return null;
}
