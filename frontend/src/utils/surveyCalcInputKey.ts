/**
 * Назначение: Ключ входа для автопересчёта.
 * Описание: Стабильная сериализация анкеты для сравнения при debounce-расчёте.
 */

import type { ObjectMetaValue } from '../types/envelope';
import type { HotWaterBoilerPowerMatchingScheme } from '../types/heatingMatching';
import type { HeatingThermalRegimePreset } from '../types/heatingThermalRegime';
import type { UfhModePresetId } from '../types/ufhModePreset';
import type { UfhDistributionPreset } from '../types/ufhDistribution';
import type { HotWaterFormValue } from '../types/hotWater';
import type { RoomFormValue } from '../types/rooms';

/**
 * Стабильный ключ входа для автопересчёта (как прежде в App: JSON.stringify ключевого объекта).
 */
export function buildSurveyCalcInputKey(params: {
  temps: { insideC: number; outsideC: number };
  objectMeta: ObjectMetaValue;
  hotWaterBoilerPowerMatchingScheme: HotWaterBoilerPowerMatchingScheme;
  hotWaterForm: HotWaterFormValue;
  rooms: RoomFormValue[];
  waterUnderfloorHeating: boolean;
  underfloorDistributionPreset: UfhDistributionPreset;
  thermalRegimePreset: HeatingThermalRegimePreset;
  ufhPresetId?: UfhModePresetId | null;
}) {
  const {
    temps,
    objectMeta,
    hotWaterBoilerPowerMatchingScheme,
    hotWaterForm,
    rooms,
    waterUnderfloorHeating,
    underfloorDistributionPreset,
    thermalRegimePreset,
    ufhPresetId = null,
  } = params;
  const key = {
    temps,
    objectMeta: {
      ...objectMeta,
      apartmentStackPosition:
        objectMeta.objectType === 'apartment'
          ? (objectMeta.apartmentStackPosition ?? 'middle_floor')
          : undefined,
    },
    hotWaterBoilerPowerMatchingScheme,
    waterUnderfloorHeating,
    underfloorDistributionPreset,
    thermalRegimePreset,
    ufhPresetId,
    hotWater: hotWaterForm,
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
          }
        : undefined,
    })),
  };
  return JSON.stringify(key);
}
