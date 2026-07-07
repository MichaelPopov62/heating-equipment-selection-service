/**
 * Назначение: ключ входа calc и canAutoCalc из снимка анкеты.
 */

import type { EnvelopePreset } from '../types/envelope';
import { buildCalcRequestPayload } from '../services/buildCalcRequestPayload';
import { buildSurveyCalcInputKey } from '../utils/surveyCalcInputKey';
import { totalExternalWallAreaM2 } from '../utils/roomEnvelopeFields';
import type { SurveyDraftSnapshot } from './types';

/**
 * @param draft
 * @returns {string}
 */
export function buildCalcInputKeyFromDraft(draft: SurveyDraftSnapshot): string {
  const baseKey = buildSurveyCalcInputKey({
    temps: draft.temps,
    objectMeta: draft.objectMeta,
    waterHeaterForm: draft.waterHeaterForm,
    hotWaterForm: draft.hotWaterForm,
    rooms: draft.rooms,
    waterUnderfloorHeating: draft.waterUnderfloorHeating,
    underfloorDistributionPreset: draft.underfloorDistributionPreset,
    thermalRegimePreset: draft.thermalRegimePreset,
    ufhPresetId: draft.ufhPresetId,
    hydraulicsForm: draft.hydraulicsForm,
  });
  const layoutKey = JSON.stringify({
    wiringLayoutV3: draft.wiringLayoutV3,
  });
  return `${baseKey}|${layoutKey}`;
}

/**
 * @param draft
 * @returns {boolean}
 */
export function canAutoCalcFromDraft(draft: SurveyDraftSnapshot): boolean {
  if (draft.rooms.length === 0) return false;
  const roomsComplete = draft.rooms.every(
    (r) =>
      typeof r.areaM2 === 'number'
      && r.areaM2 > 0
      && typeof r.heightM === 'number'
      && r.heightM > 0,
  );
  if (!roomsComplete) return false;

  return draft.rooms.some((r) => {
    if (totalExternalWallAreaM2(r) > 0) return true;
    if (r.topBoundaryType === 'roof') {
      const roofArea = typeof r.roofAreaM2 === 'number' ? r.roofAreaM2 : 0;
      if (roofArea > 0) return true;
    }
    if (r.topBoundaryType === 'unheated') {
      const ceilingArea =
        typeof r.ceilingAreaM2 === 'number' ? r.ceilingAreaM2 : 0;
      if (ceilingArea > 0) return true;
    }
    return (r.windows ?? []).some((w) => {
      const wMm = typeof w.openingWidthMm === 'number' ? w.openingWidthMm : 0;
      const hMm = typeof w.openingHeightMm === 'number' ? w.openingHeightMm : 0;
      return wMm > 0 && hMm > 0;
    });
  });
}

/**
 * @param draft
 * @param windowPresets
 */
export function buildCalcPayloadFromDraft(
  draft: SurveyDraftSnapshot,
  windowPresets: EnvelopePreset[],
): unknown {
  return buildCalcRequestPayload({
    rooms: draft.rooms,
    temps: draft.temps,
    objectMeta: draft.objectMeta,
    hotWaterForm: draft.hotWaterForm,
    waterHeaterForm: draft.waterHeaterForm,
    windowPresets,
    waterUnderfloorHeating: draft.waterUnderfloorHeating,
    underfloorDistributionPreset: draft.underfloorDistributionPreset,
    thermalRegimePreset: draft.thermalRegimePreset,
    ufhPresetId: draft.ufhPresetId,
    hydraulicsForm: draft.hydraulicsForm,
    wiringLayoutV3: draft.wiringLayoutV3,
  });
}
