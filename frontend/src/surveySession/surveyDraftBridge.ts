/**
 * Назначение: мост SurveyDraft ↔ SurveyDraftSnapshot.
 */

import { DEFAULT_HYDRAULICS_FORM } from '../types/hydraulics';
import type { SurveyDraft } from '../types/surveyDraft';
import { adaptFlatRoomsToWiringLayout } from './wiringLayoutV3';
import type { SurveyDraftSnapshot } from './types';

/**
 * @param draft
 * @returns {SurveyDraftSnapshot}
 */
export function surveyDraftToSessionSnapshot(draft: SurveyDraft): SurveyDraftSnapshot {
  const hydraulicsForm = draft.hydraulicsForm ?? { ...DEFAULT_HYDRAULICS_FORM };
  const wiringLayoutV3 = draft.wiringLayoutV3
    ?? adaptFlatRoomsToWiringLayout(draft.rooms, 'auto');

  return {
    currentStep: draft.currentStep,
    objectMeta: structuredClone(draft.objectMeta),
    rooms: structuredClone(draft.rooms),
    temps: { ...draft.temps },
    hotWaterForm: structuredClone(draft.hotWaterForm),
    waterHeaterForm: structuredClone(draft.waterHeaterForm),
    waterUnderfloorHeating: draft.waterUnderfloorHeating,
    underfloorDistributionPreset: draft.underfloorDistributionPreset ?? 'auto',
    thermalRegimePreset: draft.thermalRegimePreset,
    ufhPresetId: draft.ufhPresetId ?? null,
    hydraulicsForm: structuredClone(hydraulicsForm),
    wiringLayoutV3: structuredClone(wiringLayoutV3),
  };
}
