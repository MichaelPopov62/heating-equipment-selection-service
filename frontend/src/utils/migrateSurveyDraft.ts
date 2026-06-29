/**
 * Назначение: Нормализация snapshot черновика анкеты.
 * Описание: Единственная точка входа при загрузке из файла, MongoDB и hash-URL.
 */

import type { CalcReportJson } from '../types/calcApi';
import type { ObjectMetaValue } from '../types/envelope';
import type { HeatingThermalRegimePreset } from '../types/heatingThermalRegime';
import { isDeprecatedHeatingThermalRegimePreset } from '../types/heatingThermalRegime';
import { isUfhModePresetId } from './ufhPresetCardsForUi';
import {
  isUfhDistributionPreset,
  type UfhDistributionPreset,
} from '../types/ufhDistribution';
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
import { normalizeWaterHeaterForm } from './normalizeWaterHeaterForm';
import {
  DEFAULT_HYDRAULICS_FORM,
  type HydraulicsFormValue,
} from '../types/hydraulics';

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
 * Нормализует сохранённый snapshot в текущий контракт SurveyDraft.
 */
export function migrateSurveyDraft(raw: unknown): SurveyDraft {
  if (!isRecord(raw)) {
    throw new Error('Файл проекта: ожидается JSON-объект');
  }
  if (!isRecord(raw.objectMeta) || !Array.isArray(raw.rooms) || !isRecord(raw.temps)) {
    throw new Error('Файл проекта: неполный черновик анкеты');
  }

  const storedVersion = Number(raw.schemaVersion);
  if (Number.isFinite(storedVersion) && storedVersion > SURVEY_DRAFT_SCHEMA_VERSION) {
    throw new Error(
      `Неподдерживаемая schemaVersion: ${storedVersion} (максимум ${SURVEY_DRAFT_SCHEMA_VERSION})`,
    );
  }

  const rawMeta = raw.objectMeta as Record<string, unknown>;
  const { indirectDhwSpaceAvailable: indirectFromMeta, ...metaRest } = rawMeta;

  const waterHeaterForm = normalizeWaterHeaterForm(
    isRecord(raw.waterHeaterForm)
      ? raw.waterHeaterForm
      : {
          hotWaterBoilerPowerMatchingScheme: raw.hotWaterBoilerPowerMatchingScheme,
          indirectDhwSpaceAvailable: indirectFromMeta,
        },
  );

  const objectMeta: ObjectMetaValue = {
    ...(metaRest as ObjectMetaValue),
    externalWalls: migrateObjectMetaExternalWalls(
      (rawMeta.externalWalls as ObjectMetaValue['externalWalls']) ?? {
        presetId: 'wall_gas_concrete_d500',
        facadeSystem: 'none',
      },
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
    waterHeaterForm,
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
    hydraulicsForm: (() => {
      if (!isRecord(raw.hydraulicsForm)) {
        return { ...DEFAULT_HYDRAULICS_FORM };
      }
      const h = raw.hydraulicsForm;
      const prefRaw = h.pipeMaterialPreference;
      const pipeMaterialPreference: HydraulicsFormValue['pipeMaterialPreference'] =
        prefRaw === 'pex' || prefRaw === 'metal_plastic' || prefRaw === 'steel'
          ? prefRaw
          : '';
      return {
        mainLineLengthM:
          typeof h.mainLineLengthM === 'number' && h.mainLineLengthM >= 0
            ? h.mainLineLengthM
            : DEFAULT_HYDRAULICS_FORM.mainLineLengthM,
        deltaTSystemK:
          typeof h.deltaTSystemK === 'number' && h.deltaTSystemK > 0
            ? h.deltaTSystemK
            : DEFAULT_HYDRAULICS_FORM.deltaTSystemK,
        pipeMaterialPreference,
      } satisfies HydraulicsFormValue;
    })(),
    lastCalcReport: (isRecord(raw.lastCalcReport)
      ? raw.lastCalcReport
      : null) as CalcReportJson | null,
  };
}
