/**
 * Назначение: нормализация схемы подключения контура ТП в heatingSystem.
 * Описание: Дефолт auto; валидация enum из shared/ufhDistributionPresets.js.
 */

import {
  isUfhDistributionPreset,
} from '../../../shared/ufhDistributionPresets.js';

/**
 * @param {import('../types/shared-types').CalcRequestBody} body
 */
export function normalizeUnderfloorDistributionPreset(body) {
  const hs = body.heatingSystem;
  if (!hs || typeof hs !== 'object') return;

  if (!hs.waterUnderfloorHeating) {
    delete hs.underfloorDistributionPreset;
    return;
  }

  const raw = hs.underfloorDistributionPreset;
  if (!isUfhDistributionPreset(raw)) {
    hs.underfloorDistributionPreset = 'auto';
  }
}
