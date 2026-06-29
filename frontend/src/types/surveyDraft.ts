/**
 * Назначение: Тип черновика анкеты.
 * Описание: Формат SurveyDraft для файла, сервера и кодирования в URL-hash.
 */

import type { CalcReportJson } from './calcApi';
import type { ObjectMetaValue } from './envelope';
import type { HeatingThermalRegimePreset } from './heatingThermalRegime';
import type { UfhModePresetId } from './ufhModePreset';
import type { UfhDistributionPreset } from './ufhDistribution';
import type { HotWaterFormValue } from './hotWater';
import type { RoomFormValue } from './rooms';
import type { SurveyCurrentStep } from './surveyStep';
import type { WaterHeaterFormValue } from './waterHeater';
import type { HydraulicsFormValue } from './hydraulics';

/** Единственный контракт черновика survey (увеличивать при несовместимых изменениях). */
export const SURVEY_DRAFT_SCHEMA_VERSION = 3;

/** Снимок анкеты для файла, сервера (projects.survey) и ссылки в URL. */
export type SurveyDraft = {
  schemaVersion: number;
  savedAt: string;
  clientName: string;
  projectId?: string;
  currentStep: SurveyCurrentStep;
  objectMeta: ObjectMetaValue;
  rooms: RoomFormValue[];
  temps: { insideC: number; outsideC: number };
  hotWaterForm: HotWaterFormValue;
  waterHeaterForm: WaterHeaterFormValue;
  waterUnderfloorHeating: boolean;
  underfloorDistributionPreset: UfhDistributionPreset;
  thermalRegimePreset: HeatingThermalRegimePreset;
  ufhPresetId?: UfhModePresetId | null;
  /** Шаг «Гидравлика» (ΔT расхода, длина магистрали, материал). */
  hydraulicsForm?: HydraulicsFormValue;
  /** Последний отчёт (в ссылку URL не кладём — слишком большой). */
  lastCalcReport?: CalcReportJson | null;
};
