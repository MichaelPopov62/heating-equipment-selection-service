/**
 * Назначение: reduce шага 1 pipeline — применение мутации к черновику.
 */

import type { SurveyDraftSnapshot, SurveyMutation } from './types';

/**
 * @param draft
 * @param mutation
 * @returns {SurveyDraftSnapshot}
 */
export function reduceSurveyMutation(
  draft: SurveyDraftSnapshot,
  mutation: SurveyMutation,
): SurveyDraftSnapshot {
  switch (mutation.type) {
    case 'SET_CURRENT_STEP':
      return { ...draft, currentStep: mutation.step };
    case 'SET_OBJECT_META':
      return { ...draft, objectMeta: mutation.objectMeta };
    case 'SET_ROOMS':
      return { ...draft, rooms: mutation.rooms };
    case 'SET_TEMPS':
      return { ...draft, temps: mutation.temps };
    case 'SET_HOT_WATER_FORM':
      return { ...draft, hotWaterForm: mutation.hotWaterForm };
    case 'SET_WATER_HEATER_FORM':
      return { ...draft, waterHeaterForm: mutation.waterHeaterForm };
    case 'HEATING_EMITTERS_MODE_SET':
      return { ...draft, ufhPresetId: mutation.presetId };
    case 'WATER_UFH_FLAG_SET':
      return { ...draft, waterUnderfloorHeating: mutation.enabled };
    case 'UFH_DISTRIBUTION_PRESET_SET':
      return { ...draft, underfloorDistributionPreset: mutation.preset };
    case 'WIRING_SCHEME_SET':
      return {
        ...draft,
        wiringLayoutV3: {
          ...draft.wiringLayoutV3,
          systemType: mutation.systemType,
        },
      };
    case 'SET_THERMAL_REGIME_PRESET':
      return { ...draft, thermalRegimePreset: mutation.preset };
    case 'SET_HYDRAULICS_FORM':
      return { ...draft, hydraulicsForm: mutation.hydraulicsForm };
    case 'DRAFT_LOADED':
      return structuredClone(mutation.draft);
    case 'RUN_CALC_MANUAL':
      return draft;
    default: {
      const _exhaustive: never = mutation;
      return _exhaustive;
    }
  }
}
