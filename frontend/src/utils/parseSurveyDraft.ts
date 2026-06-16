/**
 * Назначение: Парсинг черновика анкеты.
 * Описание: Валидация JSON/файла с миграциями legacy-полей и нормализацией.
 */

import type { CalcReportJson } from '../types/calcApi';
import type { ObjectMetaValue } from '../types/envelope';
import type { HotWaterBoilerPowerMatchingScheme } from '../types/heatingMatching';
import type { HeatingThermalRegimePreset } from '../types/heatingThermalRegime';
import { isDeprecatedHeatingThermalRegimePreset } from '../types/heatingThermalRegime';
import { isUfhModePresetId } from './ufhPresetCardsForUi';
import { isUfhDistributionPreset, type UfhDistributionPreset } from '../types/ufhDistribution';
import type { HotWaterFormValue } from '../types/hotWater';
import type { RoomFormValue } from '../types/rooms';
import {
  SURVEY_DRAFT_SCHEMA_VERSION,
  type SurveyDraft,
} from '../types/surveyDraft';
import type { SurveyCurrentStep } from '../types/surveyStep';
import { isRecord } from './jsonGuards';
import { migrateObjectMetaExternalWalls } from './migrateLegacyExternalWalls';
import { migrateLegacyRoomTypes } from './migrateLegacyRoomTypes';
import { migrateRoomUnderfloorHeating } from './migrateRoomUnderfloorHeating';
import { migrateRoomEnvelopeFields } from './roomEnvelopeFields';

const SURVEY_STEPS: readonly SurveyCurrentStep[] = [
  'object',
  'rooms',
  'hotWater',
  'boiler',
  'warmFloor',
  'radiators',
  'waterHeater',
  'hydraulics',
  'summary',
];

function isSurveyStep(v: unknown): v is SurveyCurrentStep {
  return typeof v === 'string' && (SURVEY_STEPS as readonly string[]).includes(v);
}

/**
 * Разбор JSON файла / survey с сервера / hash URL.
 */
export function parseSurveyDraft(raw: unknown): SurveyDraft {
  if (!isRecord(raw)) {
    throw new Error('Файл проекта: ожидается JSON-объект');
  }
  const version = Number(raw.schemaVersion);
  if (version !== SURVEY_DRAFT_SCHEMA_VERSION) {
    throw new Error(
      `Неподдерживаемая версия черновика: ${String(raw.schemaVersion)} (ожидается ${SURVEY_DRAFT_SCHEMA_VERSION})`,
    );
  }
  if (!isRecord(raw.objectMeta) || !Array.isArray(raw.rooms) || !isRecord(raw.temps)) {
    throw new Error('Файл проекта: неполный черновик анкеты');
  }

  const rawMeta = raw.objectMeta as ObjectMetaValue;
  const objectMeta: ObjectMetaValue = {
    ...rawMeta,
    externalWalls: migrateObjectMetaExternalWalls(
      rawMeta.externalWalls ?? { presetId: 'wall_gas_concrete_d500', facadeSystem: 'none' },
    ),
  };
  const rooms = migrateRoomUnderfloorHeating(
    migrateRoomEnvelopeFields(migrateLegacyRoomTypes(raw.rooms as RoomFormValue[])),
  );

  const clientName =
    typeof raw.clientName === 'string' && raw.clientName.trim()
      ? raw.clientName.trim()
      : 'Без имени';

  return {
    schemaVersion: SURVEY_DRAFT_SCHEMA_VERSION,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : new Date().toISOString(),
    clientName,
    projectId: typeof raw.projectId === 'string' ? raw.projectId : undefined,
    currentStep: isSurveyStep(raw.currentStep) ? raw.currentStep : 'object',
    objectMeta,
    rooms,
    temps: {
      insideC: Number(raw.temps.insideC) || 20,
      outsideC: Number(raw.temps.outsideC) || -5,
    },
    hotWaterForm: (isRecord(raw.hotWaterForm)
      ? raw.hotWaterForm
      : {}) as HotWaterFormValue,
    hotWaterBoilerPowerMatchingScheme: String(
      raw.hotWaterBoilerPowerMatchingScheme ?? '',
    ) as HotWaterBoilerPowerMatchingScheme,
    waterUnderfloorHeating: Boolean(raw.waterUnderfloorHeating),
    underfloorDistributionPreset: (() => {
      const v = String(raw.underfloorDistributionPreset ?? 'auto');
      return isUfhDistributionPreset(v) ? v : ('auto' satisfies UfhDistributionPreset);
    })(),
    thermalRegimePreset: (() => {
      const preset = String(raw.thermalRegimePreset ?? '') as HeatingThermalRegimePreset;
      if (isDeprecatedHeatingThermalRegimePreset(preset)) {
        return 'traditional_dt50_75_65' satisfies HeatingThermalRegimePreset;
      }
      return preset;
    })(),
    ufhPresetId: (() => {
      const id = String(raw.ufhPresetId ?? '').trim();
      return isUfhModePresetId(id) ? id : null;
    })(),
    lastCalcReport: (isRecord(raw.lastCalcReport)
      ? raw.lastCalcReport
      : null) as CalcReportJson | null,
  };
}
