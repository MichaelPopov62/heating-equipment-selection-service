/**
 * Назначение: Сборка черновика анкеты.
 * Описание: Формирование SurveyDraft из текущего состояния всех шагов мастера.
 */

import type { CalcReportJson } from '../types/calcApi';
import type { ObjectMetaValue } from '../types/envelope';
import type { HeatingThermalRegimePreset } from '../types/heatingThermalRegime';
import type { UfhModePresetId } from '../types/ufhModePreset';
import type { UfhDistributionPreset } from '../types/ufhDistribution';
import type { HotWaterFormValue } from '../types/hotWater';
import type { WaterHeaterFormValue } from '../types/waterHeater';
import type { RoomFormValue } from '../types/rooms';
import {
  SURVEY_DRAFT_SCHEMA_VERSION,
  type SurveyDraft,
} from '../types/surveyDraft';
import type { SurveyCurrentStep } from '../types/surveyStep';
import type { HydraulicsFormValue } from '../types/hydraulics';
import type { WiringLayoutV3 } from '../surveySession/wiringLayoutV3';
import { DEFAULT_HYDRAULICS_FORM } from '../types/hydraulics';

export function buildSurveyDraft(params: {
  clientName: string;
  projectId?: string | null;
  currentStep: SurveyCurrentStep;
  objectMeta: ObjectMetaValue;
  rooms: RoomFormValue[];
  temps: { insideC: number; outsideC: number; bathroomAirTempC?: number };
  hotWaterForm: HotWaterFormValue;
  waterHeaterForm: WaterHeaterFormValue;
  waterUnderfloorHeating: boolean;
  underfloorDistributionPreset: UfhDistributionPreset;
  thermalRegimePreset: HeatingThermalRegimePreset;
  ufhPresetId?: UfhModePresetId | null;
  hydraulicsForm?: HydraulicsFormValue;
  wiringLayoutV3?: WiringLayoutV3;
  lastCalcReport?: CalcReportJson | null;
}): SurveyDraft {
  const name = params.clientName.trim() || 'Без имени';
  return {
    schemaVersion: SURVEY_DRAFT_SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    clientName: name,
    projectId: params.projectId ?? undefined,
    currentStep: params.currentStep,
    objectMeta: structuredClone(params.objectMeta),
    rooms: structuredClone(params.rooms),
    temps: { ...params.temps },
    hotWaterForm: structuredClone(params.hotWaterForm),
    waterHeaterForm: structuredClone(params.waterHeaterForm),
    waterUnderfloorHeating: params.waterUnderfloorHeating,
    underfloorDistributionPreset: params.underfloorDistributionPreset,
    thermalRegimePreset: params.thermalRegimePreset,
    ufhPresetId: params.ufhPresetId ?? null,
    hydraulicsForm: structuredClone(params.hydraulicsForm ?? DEFAULT_HYDRAULICS_FORM),
    ...(params.wiringLayoutV3
      ? { wiringLayoutV3: structuredClone(params.wiringLayoutV3) }
      : {}),
    lastCalcReport: params.lastCalcReport ?? null,
  };
}
