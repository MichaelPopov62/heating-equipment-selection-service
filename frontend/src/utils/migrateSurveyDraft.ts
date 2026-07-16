/**
 * Назначение: Нормализация snapshot черновика анкеты.
 * Описание: Единственная точка входа при загрузке из файла, MongoDB и hash-URL.
 */

import { isSurveyStep } from '../constants/surveySteps';
import type { ObjectMetaValue } from '../types/envelope';
import type { HeatingThermalRegimePreset } from '../types/heatingThermalRegime';
import { isDeprecatedHeatingThermalRegimePreset } from '../types/heatingThermalRegime';
import { normalizeRadiatorConnection } from '../types/radiatorConnection';
import { normalizeRadiatorEmitterPreference } from '../types/radiatorEmitterPreference';
import type { LegacyWiringBranch } from '../types/surveyDraftCompat';
import {
  SURVEY_DRAFT_SCHEMA_VERSION,
  type SurveyDraft,
} from '../types/surveyDraft';
import {
  isUfhDistributionPreset,
  type UfhDistributionPreset,
} from '../types/ufhDistribution';
import type { RoomFormValue } from '../types/rooms';
import {
  adaptFlatRoomsToWiringLayout,
  type WiringLayoutV3,
} from '../surveySession/wiringLayoutV3';
import { warnCompatMigration } from './compatTelemetry';
import { isRecord, readRecordField } from './jsonGuards';
import { migrateObjectMetaExternalWalls } from './migrateLegacyExternalWalls';
import { migrateLegacyRoomTypes } from './migrateLegacyRoomTypes';
import { migrateRoomUnderfloorHeating } from './migrateRoomUnderfloorHeating';
import { normalizeHotWaterForm } from './normalizeHotWaterForm';
import { normalizeWaterHeaterForm } from './normalizeWaterHeaterForm';
import { migrateRoomEnvelopeFields } from './roomEnvelopeFields';
import { isUfhModePresetId } from './ufhPresetCardsForUi';
import {
  DEFAULT_HYDRAULICS_FORM,
  type HydraulicsFormValue,
} from '../types/hydraulics';

/** Строка из неизвестного JSON-поля (объекты не stringify). */
function readJsonString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
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

  if (Number.isFinite(storedVersion) && storedVersion < SURVEY_DRAFT_SCHEMA_VERSION) {
    warnCompatMigration(
      'SurveyDraftLoad',
      `schemaVersion ${storedVersion} → ${SURVEY_DRAFT_SCHEMA_VERSION}`,
    );
  }

  const rawMeta = raw.objectMeta;
  const { indirectDhwSpaceAvailable: indirectFromMeta, ...metaRest } = rawMeta;

  if (
    raw.hotWaterBoilerPowerMatchingScheme != null ||
    indirectFromMeta != null
  ) {
    warnCompatMigration('SurveyDraftLoad', 'корневые поля ГВС/БКН → waterHeaterForm');
  }

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
      (() => {
        const ew = readRecordField(rawMeta, 'externalWalls');
        if (ew && typeof ew.presetId === 'string') {
          return ew as ObjectMetaValue['externalWalls'];
        }
        return {
          presetId: 'wall_gas_concrete_d500',
          facadeSystem: 'none' as const,
        };
      })(),
    ),
  };

  const rooms = migrateRoomUnderfloorHeating(
    migrateRoomEnvelopeFields(migrateLegacyRoomTypes(raw.rooms as RoomFormValue[])),
  );

  const clientName =
    typeof raw.clientName === 'string' && raw.clientName.trim()
      ? raw.clientName.trim()
      : 'Без имени';

  const thermalRegimePreset = (() => {
    const preset = readJsonString(raw.thermalRegimePreset) as HeatingThermalRegimePreset;
    if (isDeprecatedHeatingThermalRegimePreset(preset)) {
      warnCompatMigration('SurveyDraftLoad', `thermalRegimePreset ${preset} → traditional_dt50_75_65`);
      return 'traditional_dt50_75_65' satisfies HeatingThermalRegimePreset;
    }
    return preset;
  })();

  return {
    schemaVersion: SURVEY_DRAFT_SCHEMA_VERSION,
    savedAt: typeof raw.savedAt === 'string' ? raw.savedAt : new Date().toISOString(),
    clientName,
    ...(typeof raw.projectId === 'string' ? { projectId: raw.projectId } : {}),
    currentStep: isSurveyStep(raw.currentStep) ? raw.currentStep : 'object',
    objectMeta,
    rooms,
    temps: {
      insideC: Number(raw.temps.insideC) || 20,
      outsideC: Number(raw.temps.outsideC) || -5,
      ...(typeof raw.temps.bathroomAirTempC === 'number' &&
      Number.isFinite(raw.temps.bathroomAirTempC) &&
      raw.temps.bathroomAirTempC >= 24
        ? { bathroomAirTempC: raw.temps.bathroomAirTempC }
        : {}),
    },
    hotWaterForm: normalizeHotWaterForm(raw.hotWaterForm),
    waterHeaterForm,
    waterUnderfloorHeating: Boolean(raw.waterUnderfloorHeating),
    underfloorDistributionPreset: (() => {
      const v = readJsonString(raw.underfloorDistributionPreset, 'auto');
      return isUfhDistributionPreset(v) ? v : ('auto' satisfies UfhDistributionPreset);
    })(),
    thermalRegimePreset,
    radiatorConnection: normalizeRadiatorConnection(
      raw.radiatorConnection,
    ),
    radiatorEmitterPreference: normalizeRadiatorEmitterPreference(
      raw.radiatorEmitterPreference,
    ),
    ufhPresetId: (() => {
      const id = readJsonString(raw.ufhPresetId).trim();
      if (!id) return null;
      if (id === 'ufh_direct_tile' || id === 'ufh_direct_laminate') {
        warnCompatMigration('SurveyDraftLoad', `${id} → ufh_mixed_radiators`);
        return 'ufh_mixed_radiators';
      }
      return isUfhModePresetId(id) ? id : null;
    })(),
    hydraulicsForm: (() => {
      if (!isRecord(raw.hydraulicsForm)) {
        if (raw.hydraulicsForm != null) {
          warnCompatMigration('SurveyDraftLoad', 'hydraulicsForm → DEFAULT_HYDRAULICS_FORM');
        }
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
    wiringLayoutV3: (() => {
      if (isRecord(raw.wiringLayoutV3) && raw.wiringLayoutV3.schemaVersion === 3) {
        const wl = raw.wiringLayoutV3 as WiringLayoutV3 & {
          branches?: LegacyWiringBranch[];
        };
        const branches: LegacyWiringBranch[] = Array.isArray(wl.branches)
          ? wl.branches
          : [];
        const hasLegacyBranchLength = branches.some(
          (b) =>
            b.estimatedLengthM != null &&
            b.pipeLengthToEquipmentM == null,
        );
        if (hasLegacyBranchLength) {
          warnCompatMigration('WiringLayoutV3', 'estimatedLengthM → pipeLengthToEquipmentM');
        }
        return {
          ...wl,
          branches: branches.map((b) => ({
            roomId: b.roomId,
            pipeLengthToEquipmentM:
              typeof b.pipeLengthToEquipmentM === 'number'
                ? b.pipeLengthToEquipmentM
                : typeof b.estimatedLengthM === 'number'
                  ? b.estimatedLengthM
                  : 4,
          })),
        } satisfies WiringLayoutV3;
      }
      if (raw.wiringLayoutV3 != null) {
        warnCompatMigration('WiringLayoutV3', 'rebuild from rooms (schemaVersion ≠ 3)');
      }
      return adaptFlatRoomsToWiringLayout(rooms, 'auto');
    })(),
    lastCalcReport: (isRecord(raw.lastCalcReport)
      ? raw.lastCalcReport
      : null),
  };
}
