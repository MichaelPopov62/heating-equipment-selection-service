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
    case 'SET_WIRING_BRANCHES':
      return {
        ...draft,
        wiringLayoutV3: {
          ...draft.wiringLayoutV3,
          branches: structuredClone(mutation.branches),
          metadata: {
            ...draft.wiringLayoutV3.metadata,
            migratedFrom: 'native-v3',
            updatedAt: new Date().toISOString(),
          },
        },
      };
    case 'WIRING_BRANCH_LENGTH_SET':
      return {
        ...draft,
        wiringLayoutV3: {
          ...draft.wiringLayoutV3,
          branches: draft.wiringLayoutV3.branches.map((b) =>
            b.roomId === mutation.roomId
              ? { ...b, pipeLengthToEquipmentM: mutation.pipeLengthToEquipmentM }
              : b,
          ),
          metadata: {
            ...draft.wiringLayoutV3.metadata,
            migratedFrom: 'native-v3',
            updatedAt: new Date().toISOString(),
          },
        },
      };
    case 'WIRING_BRANCH_REORDER': {
      const branches = [...draft.wiringLayoutV3.branches];
      const idx = branches.findIndex((b) => b.roomId === mutation.roomId);
      if (idx < 0) return draft;
      const swapIdx = mutation.direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= branches.length) return draft;
      const tmp = branches[idx];
      branches[idx] = branches[swapIdx];
      branches[swapIdx] = tmp;
      return {
        ...draft,
        wiringLayoutV3: {
          ...draft.wiringLayoutV3,
          branches,
          metadata: {
            ...draft.wiringLayoutV3.metadata,
            migratedFrom: 'native-v3',
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }
    case 'SET_THERMAL_REGIME_PRESET':
      return { ...draft, thermalRegimePreset: mutation.preset };
    case 'SET_RADIATOR_CONNECTION':
      return { ...draft, radiatorConnection: mutation.connection };
    case 'SET_RADIATOR_EMITTER_PREFERENCE':
      return { ...draft, radiatorEmitterPreference: mutation.preference };
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
