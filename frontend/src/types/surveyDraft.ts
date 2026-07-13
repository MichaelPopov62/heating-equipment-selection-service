/**
 * Назначение: Тип черновика анкеты.
 * Описание: Формат SurveyDraft для файла, сервера и кодирования в URL-hash.
 */

import type { CalcReportJson } from './calcApi';
import type { ObjectMetaValue } from './envelope';
import type { HeatingThermalRegimePreset } from './heatingThermalRegime';
import type { RadiatorConnection } from './radiatorConnection';
import type { RadiatorEmitterPreference } from './radiatorEmitterPreference';
import type { UfhModePresetId } from './ufhModePreset';
import type { UfhDistributionPreset } from './ufhDistribution';
import type { HotWaterFormValue } from './hotWater';
import type { RoomFormValue } from './rooms';
import type { SurveyCurrentStep } from './surveyStep';
import type { WaterHeaterFormValue } from './waterHeater';
import type { HydraulicsFormValue } from './hydraulics';
import type { WiringLayoutV3 } from '../surveySession/wiringLayoutV3';

/** Единственный контракт черновика survey (увеличивать при несовместимых изменениях). */
export const SURVEY_DRAFT_SCHEMA_VERSION = 4;

/** Снимок анкеты для файла, сервера (projects.survey) и ссылки в URL. */
export type SurveyDraft = {
  schemaVersion: number;
  savedAt: string;
  clientName: string;
  projectId?: string;
  currentStep: SurveyCurrentStep;
  objectMeta: ObjectMetaValue;
  rooms: RoomFormValue[];
  temps: { insideC: number; outsideC: number; bathroomAirTempC?: number };
  hotWaterForm: HotWaterFormValue;
  waterHeaterForm: WaterHeaterFormValue;
  waterUnderfloorHeating: boolean;
  underfloorDistributionPreset: UfhDistributionPreset;
  thermalRegimePreset: HeatingThermalRegimePreset;
  /** Подводка радиаторов: side (боковая) | bottom (нижняя). */
  radiatorConnection: RadiatorConnection;
  /** Глобальный тип приборов: auto | sectional | panel. */
  radiatorEmitterPreference: RadiatorEmitterPreference;
  ufhPresetId?: UfhModePresetId | null;
  /** Шаг «Гидравлика» (ΔT расхода, длина магистрали, материал). */
  hydraulicsForm?: HydraulicsFormValue;
  /** Layout разводки v3 (ветки; auto = серверный buildGraph). */
  wiringLayoutV3?: WiringLayoutV3;
  /** Последний отчёт (в ссылку URL не кладём — слишком большой). */
  lastCalcReport?: CalcReportJson | null;
};
