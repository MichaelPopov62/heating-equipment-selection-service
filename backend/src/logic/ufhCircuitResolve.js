/**
 * Назначение: выбор пресета температуры контура ТП по финишу комнаты.
 * Описание: Обёртка над shared/ufhCircuitPresets.js для расчётного ядра backend.
 */

import {
  resolveUfhCircuitPresetForFinishMaterialId,
  UFH_CIRCUIT_PRESETS,
} from '../../../shared/ufhCircuitPresets.js';

export { resolveUfhCircuitPresetForFinishMaterialId, UFH_CIRCUIT_PRESETS };

/**
 * @param {string} finishMaterialId
 * @returns {{ preset: import('../../../shared/ufhCircuitPresets.js').UfhCircuitPresetConfig, source: 'finish_preset' } | null}
 */
export function resolveUfhCircuitForFinish(finishMaterialId) {
  const preset = resolveUfhCircuitPresetForFinishMaterialId(finishMaterialId);
  if (!preset) return null;
  return { preset, source: 'finish_preset' };
}
