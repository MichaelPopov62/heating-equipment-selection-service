/**
 * Назначение: определение смешанного режима «радиаторы + ТП» для подбора излучателей.
 * Описание: Вычитание heatFluxUpWatts применяется только в mixed, не при ufh_only / radiators.
 */

import { UFH_PRESET_ONLY } from '../../../../shared/ufhModePresetIds.js';

/**
 * @param {import('../../types/shared-types').HeatingSystemInput | undefined | null} heatingSystem
 * @returns {boolean}
 */
export function isMixedRadiatorsUfhHeatingMode(heatingSystem) {
  const mode = heatingSystem?.heatingEmittersMode;
  if (mode === UFH_PRESET_ONLY || mode === 'ufh_only') return false;
  if (mode === 'radiators') return false;
  if (mode === 'mixed') return true;

  const presetId =
    typeof heatingSystem?.ufhPresetId === 'string'
      ? heatingSystem.ufhPresetId.trim()
      : '';
  if (presetId === UFH_PRESET_ONLY) return false;
  if (presetId) return true;

  return Boolean(heatingSystem?.waterUnderfloorHeating);
}
