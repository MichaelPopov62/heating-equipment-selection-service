/**
 * Назначение: пустое состояние сессии для cold open (Start State).
 */

import { DEFAULT_HYDRAULICS_FORM } from '../types/hydraulics';
import { createDefaultWaterHeaterFormValue } from '../utils/waterHeaterFormDefaults';
import { createDefaultHotWaterFormValue } from '../utils/hotWaterFormDefaults';
import { recommendedThermalRegimePresetForScheme } from '../types/heatingThermalRegime';
import { DEFAULT_RADIATOR_CONNECTION } from '../types/radiatorConnection';
import { DEFAULT_RADIATOR_EMITTER_PREFERENCE } from '../types/radiatorEmitterPreference';
import { buildCalcInputKeyFromDraft } from './buildCalcInputSnapshot';
import { createInitialDraftSnapshot } from './migrateDerivedState';
import type { SurveyDraftSnapshot, SurveySessionState } from './types';

/**
 * Минимальный snapshot без комнат — calc и persist не активны.
 *
 * @returns {SurveyDraftSnapshot}
 */
export function createEmptySurveyDraftSnapshot(): SurveyDraftSnapshot {
  const waterHeaterForm = createDefaultWaterHeaterFormValue();
  const thermalRegimePreset = recommendedThermalRegimePresetForScheme(
    waterHeaterForm.hotWaterBoilerPowerMatchingScheme,
    'house',
  );

  return createInitialDraftSnapshot({
    objectMeta: {
      objectType: 'house',
      apartmentStackPosition: 'middle_floor',
      floors: 1,
      roomsCount: 1,
      externalWalls: {
        presetId: 'wall_gas_concrete_d500',
        thicknessMm: 300,
        facadeSystem: 'none',
      },
      roofPresetId: 'roof_concrete_insulated_flat',
      boilerPlacementZone: 'kitchen',
      ventilationReserveMode: 'natural',
    },
    rooms: [],
    hotWaterForm: createDefaultHotWaterFormValue(),
    waterHeaterForm,
    thermalRegimePreset,
    radiatorConnection: DEFAULT_RADIATOR_CONNECTION,
    radiatorEmitterPreference: DEFAULT_RADIATOR_EMITTER_PREFERENCE,
    hydraulicsForm: { ...DEFAULT_HYDRAULICS_FORM },
  });
}

/**
 * @returns {SurveySessionState}
 */
export function createEmptySurveySessionState(): SurveySessionState {
  const draft = createEmptySurveyDraftSnapshot();
  const calcInputKey = buildCalcInputKeyFromDraft(draft);

  return {
    draft,
    report: null,
    reportEpoch: 0,
    uiPhase: 'idle',
    calcError: null,
    draftInitializing: false,
    thermalRegimeTouched: false,
    calcInputKey,
  };
}
