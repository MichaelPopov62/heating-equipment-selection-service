/**
 * Назначение: Ключ входа для автопересчёта.
 * Описание: Стабильная сериализация анкеты для сравнения при debounce-расчёте.
 */

import type { ObjectMetaValue } from '../types/envelope';
import type { HeatingThermalRegimePreset } from '../types/heatingThermalRegime';
import {
  DEFAULT_RADIATOR_CONNECTION,
  type RadiatorConnection,
} from '../types/radiatorConnection';
import {
  DEFAULT_RADIATOR_EMITTER_PREFERENCE,
  type RadiatorEmitterPreference,
} from '../types/radiatorEmitterPreference';
import type { UfhModePresetId } from '../types/ufhModePreset';
import type { UfhDistributionPreset } from '../types/ufhDistribution';
import type { HotWaterFormValue } from '../types/hotWater';
import type { WaterHeaterFormValue } from '../types/waterHeater';
import type { RoomFormValue } from '../types/rooms';
import { objectMetaForCalcPayload } from './objectMetaForCalcPayload';

/**
 * Стабильный ключ входа для автопересчёта (как прежде в App: JSON.stringify ключевого объекта).
 */
export function buildSurveyCalcInputKey(params: {
  temps: { insideC: number; outsideC: number; bathroomAirTempC?: number };
  objectMeta: ObjectMetaValue;
  waterHeaterForm: WaterHeaterFormValue;
  hotWaterForm: HotWaterFormValue;
  rooms: RoomFormValue[];
  waterUnderfloorHeating: boolean;
  underfloorDistributionPreset: UfhDistributionPreset;
  thermalRegimePreset: HeatingThermalRegimePreset;
  radiatorConnection?: RadiatorConnection;
  radiatorEmitterPreference?: RadiatorEmitterPreference;
  ufhPresetId?: UfhModePresetId | null;
  hydraulicsForm?: import('../types/hydraulics').HydraulicsFormValue;
}) {
  const {
    temps,
    objectMeta,
    waterHeaterForm,
    hotWaterForm,
    rooms,
    waterUnderfloorHeating,
    underfloorDistributionPreset,
    thermalRegimePreset,
    radiatorConnection = DEFAULT_RADIATOR_CONNECTION,
    radiatorEmitterPreference = DEFAULT_RADIATOR_EMITTER_PREFERENCE,
    ufhPresetId = null,
    hydraulicsForm,
  } = params;

  const objectMetaForKey = objectMetaForCalcPayload(objectMeta, waterHeaterForm);

  const key = {
    temps,
    objectMeta: {
      ...objectMetaForKey,
      apartmentStackPosition:
        objectMetaForKey.objectType === 'apartment'
          ? (objectMetaForKey.apartmentStackPosition ?? 'middle_floor')
          : undefined,
    },
    hotWaterBoilerPowerMatchingScheme:
      waterHeaterForm.hotWaterBoilerPowerMatchingScheme,
    waterUnderfloorHeating,
    underfloorDistributionPreset,
    thermalRegimePreset,
    radiatorConnection,
    radiatorEmitterPreference,
    ufhPresetId,
    hotWater: hotWaterForm,
    hydraulics: hydraulicsForm,
    rooms: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      floor: r.floor,
      topBoundaryType: r.topBoundaryType,
      bottomBoundaryType: r.bottomBoundaryType,
      areaM2: r.areaM2,
      heightM: r.heightM,
      floorPresetId: r.floorPresetId,
      ceilingPresetId: r.ceilingPresetId,
      roofPresetId: r.roofPresetId,
      externalWall1: r.externalWall1,
      externalWall2: r.externalWall2,
      roomExteriorLayout: r.roomExteriorLayout,
      ceilingAreaM2: r.ceilingAreaM2,
      roofAreaM2: r.roofAreaM2,
      windows: (r.windows ?? []).map((w) => ({
        id: w.id,
        presetId: w.presetId,
        openingWidthMm: w.openingWidthMm,
        openingHeightMm: w.openingHeightMm,
        orientation: w.orientation,
        count: w.count,
      })),
      underfloorHeating: r.underfloorHeating?.enabled
        ? {
            enabled: true,
            basePresetId: r.underfloorHeating.basePresetId,
            finishMaterialId: r.underfloorHeating.finishMaterialId,
            pipeSpacingMm:
              r.underfloorHeating.pipeSpacingMm === 100
              || r.underfloorHeating.pipeSpacingMm === 150
              || r.underfloorHeating.pipeSpacingMm === 200
                ? r.underfloorHeating.pipeSpacingMm
                : 150,
            furnitureOccupiedAreaM2: r.underfloorHeating.furnitureOccupiedAreaM2,
            ufhTerminalControl: r.underfloorHeating.ufhTerminalControl,
          }
        : undefined,
    })),
  };
  return JSON.stringify(key);
}
