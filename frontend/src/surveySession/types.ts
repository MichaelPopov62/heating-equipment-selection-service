/**
 * Назначение: типы единой сессии анкеты и мутаций.
 */

import type { CalcReportJson } from '../types/calcApi';
import type { ObjectMetaValue } from '../types/envelope';
import type { HeatingThermalRegimePreset } from '../types/heatingThermalRegime';
import type { RadiatorConnection } from '../types/radiatorConnection';
import type { RadiatorEmitterPreference } from '../types/radiatorEmitterPreference';
import type { UfhModePresetId } from '../types/ufhModePreset';
import type { UfhDistributionPreset } from '../types/ufhDistribution';
import type { HotWaterFormValue } from '../types/hotWater';
import type { RoomFormValue } from '../types/rooms';
import type { SurveyCurrentStep } from '../types/surveyStep';
import type { WaterHeaterFormValue } from '../types/waterHeater';
import type { HydraulicsFormValue } from '../types/hydraulics';
import type { WiringBranchV3, WiringLayoutV3, WiringSystemType } from './wiringLayoutV3';

/** Фаза UI отчёта: все секции используют один флаг. */
export type SurveyUiPhase = 'idle' | 'stable' | 'recalculating' | 'error';

/** Снимок полей анкеты в сессии. */
export type SurveyDraftSnapshot = {
  currentStep: SurveyCurrentStep;
  objectMeta: ObjectMetaValue;
  rooms: RoomFormValue[];
  temps: { insideC: number; outsideC: number; bathroomAirTempC?: number };
  hotWaterForm: HotWaterFormValue;
  waterHeaterForm: WaterHeaterFormValue;
  waterUnderfloorHeating: boolean;
  underfloorDistributionPreset: UfhDistributionPreset;
  thermalRegimePreset: HeatingThermalRegimePreset;
  radiatorConnection: RadiatorConnection;
  radiatorEmitterPreference: RadiatorEmitterPreference;
  ufhPresetId: UfhModePresetId | null;
  hydraulicsForm: HydraulicsFormValue;
  wiringLayoutV3: WiringLayoutV3;
};

export type SurveyMutation =
  | { type: 'SET_CURRENT_STEP'; step: SurveyCurrentStep }
  | { type: 'SET_OBJECT_META'; objectMeta: ObjectMetaValue }
  | { type: 'SET_ROOMS'; rooms: RoomFormValue[] }
  | { type: 'SET_TEMPS'; temps: { insideC: number; outsideC: number; bathroomAirTempC?: number } }
  | { type: 'SET_HOT_WATER_FORM'; hotWaterForm: HotWaterFormValue }
  | { type: 'SET_WATER_HEATER_FORM'; waterHeaterForm: WaterHeaterFormValue }
  | { type: 'HEATING_EMITTERS_MODE_SET'; presetId: UfhModePresetId | null }
  | { type: 'WATER_UFH_FLAG_SET'; enabled: boolean }
  | { type: 'UFH_DISTRIBUTION_PRESET_SET'; preset: UfhDistributionPreset }
  | { type: 'WIRING_SCHEME_SET'; systemType: WiringSystemType }
  | { type: 'SET_WIRING_BRANCHES'; branches: WiringBranchV3[] }
  | { type: 'WIRING_BRANCH_LENGTH_SET'; roomId: string; pipeLengthToEquipmentM: number }
  | { type: 'WIRING_BRANCH_REORDER'; roomId: string; direction: 'up' | 'down' }
  | { type: 'SET_THERMAL_REGIME_PRESET'; preset: HeatingThermalRegimePreset; touched?: boolean }
  | { type: 'SET_RADIATOR_CONNECTION'; connection: RadiatorConnection }
  | { type: 'SET_RADIATOR_EMITTER_PREFERENCE'; preference: RadiatorEmitterPreference }
  | { type: 'SET_HYDRAULICS_FORM'; hydraulicsForm: HydraulicsFormValue }
  | { type: 'DRAFT_LOADED'; draft: SurveyDraftSnapshot; lastCalcReport?: CalcReportJson | null }
  | { type: 'RUN_CALC_MANUAL' };

/** Действие calc-исполнителя после pipeline. */
export type SurveyCalcAction = 'none' | 'schedule' | 'schedule_immediate' | 'abort_only';

export type SurveySessionState = {
  draft: SurveyDraftSnapshot;
  report: CalcReportJson | null;
  reportEpoch: number;
  uiPhase: SurveyUiPhase;
  calcError: string | null;
  draftInitializing: boolean;
  thermalRegimeTouched: boolean;
  calcInputKey: string;
};

export type SurveyPipelineResult = {
  state: SurveySessionState;
  calcAction: SurveyCalcAction;
};
