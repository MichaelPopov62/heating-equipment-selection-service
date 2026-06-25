/**
 * Назначение: Сборка тела запроса расчёта.
 * Описание: Преобразование состояния анкеты в JSON по контракту CalcInput для API.
 */

import { DEFAULT_WINDOW_PRESET_ID } from '../data/fallbackEnvelopePresets';
import type { EnvelopePreset, ObjectMetaValue } from '../types/envelope';
import type { UfhModePresetId } from '../types/ufhModePreset';
import type { HeatingThermalRegimePreset } from '../types/heatingThermalRegime';
import type { UfhDistributionPreset } from '../types/ufhDistribution';
import type { HotWaterFormValue } from '../types/hotWater';
import type { WaterHeaterFormValue } from '../types/waterHeater';
import type { RoomFormValue } from '../types/rooms';
import { objectMetaForCalcPayload } from '../utils/objectMetaForCalcPayload';
import { inferRoomExteriorLayout, wallEnvelopeEntriesForRoom } from '../utils/roomExteriorLayout';

/**
 * Сборка тела POST /api/v1/calc из состояния анкеты (логика перенесена из App без изменений).
 */
export function buildCalcRequestPayload(params: {
  rooms: RoomFormValue[];
  temps: { insideC: number; outsideC: number };
  objectMeta: ObjectMetaValue;
  hotWaterForm: HotWaterFormValue;
  waterHeaterForm: WaterHeaterFormValue;
  windowPresets: EnvelopePreset[];
  waterUnderfloorHeating?: boolean;
  underfloorDistributionPreset?: UfhDistributionPreset;
  thermalRegimePreset: HeatingThermalRegimePreset;
  ufhPresetId?: UfhModePresetId | null;
}) {
  const {
    rooms,
    temps,
    objectMeta,
    hotWaterForm,
    waterHeaterForm,
    windowPresets,
    waterUnderfloorHeating = false,
    underfloorDistributionPreset = 'auto',
    thermalRegimePreset,
    ufhPresetId = null,
  } = params;

  const buildingRooms = rooms.map((r) => {
    const room: Record<string, unknown> = {
      id: r.id,
      name: r.name,
      type: r.type,
      floor: r.floor,
      topBoundary: r.topBoundaryType,
      bottomBoundary: r.bottomBoundaryType,
      areaM2: Number(r.areaM2),
      heightM: Number(r.heightM),
      roomExteriorLayout: inferRoomExteriorLayout(r),
    };
    if (waterUnderfloorHeating && r.underfloorHeating?.enabled) {
      const basePresetId = r.underfloorHeating.basePresetId?.trim() ?? '';
      const finishMaterialId = r.underfloorHeating.finishMaterialId?.trim() ?? '';
      if (basePresetId && finishMaterialId) {
        const spacing = r.underfloorHeating.pipeSpacingMm;
        const pipeSpacingMm =
          spacing === 100 || spacing === 150 || spacing === 200 ? spacing : 150;
        room.underfloorHeating = {
          enabled: true,
          basePresetId,
          finishMaterialId,
          pipeSpacingMm,
        };
      }
    }
    return room;
  });

  const envelopeElements = rooms.flatMap((r) => {
    const els: Array<Record<string, unknown>> = [];

    const externalWalls = wallEnvelopeEntriesForRoom(r);
    for (const { wall, label, construction } of externalWalls) {
      const area = typeof wall.areaM2 === 'number' ? wall.areaM2 : 0;
      if (area <= 0) continue;
      els.push({
        kind: 'wall',
        roomId: r.id,
        name: label,
        construction,
        presetId: objectMeta.externalWalls.presetId,
        areaM2: area,
        orientation: wall.orientation,
      });
    }

    const floorArea = typeof r.areaM2 === 'number' ? r.areaM2 : 0;
    if (floorArea > 0 && r.floorPresetId) {
      els.push({
        kind: 'floor',
        roomId: r.id,
        construction: 'пол',
        presetId: r.floorPresetId,
        areaM2: floorArea,
        name: 'Пол',
      });
    }

    if (r.topBoundaryType === 'roof') {
      const roofArea = typeof r.roofAreaM2 === 'number' ? r.roofAreaM2 : 0;
      if (roofArea > 0) {
        els.push({
          kind: 'roof',
          roomId: r.id,
          construction: 'кровля',
          presetId: r.roofPresetId || objectMeta.roofPresetId,
          areaM2: roofArea,
          name: 'Скаты кровли',
        });
      }
    } else if (r.topBoundaryType === 'unheated') {
      const ceilingArea = typeof r.ceilingAreaM2 === 'number' ? r.ceilingAreaM2 : 0;
      if (ceilingArea > 0) {
        els.push({
          kind: 'ceiling',
          roomId: r.id,
          construction: 'потолок',
          presetId: r.ceilingPresetId,
          areaM2: ceilingArea,
          name: 'Потолок',
        });
      }
    }

    for (const w of r.windows ?? []) {
      const wMm = typeof w.openingWidthMm === 'number' ? w.openingWidthMm : null;
      const hMm = typeof w.openingHeightMm === 'number' ? w.openingHeightMm : null;
      if (!wMm || !hMm) continue;
      const areaM2 = (wMm * hMm) / 1_000_000;
      const count = typeof w.count === 'number' && w.count > 0 ? w.count : 1;
      const winPresetOk =
        typeof w.presetId === 'string' &&
        w.presetId.trim() !== '' &&
        windowPresets.some((p) => p.id === w.presetId);
      const presetIdResolved = winPresetOk
        ? w.presetId
        : (windowPresets[0]?.id ?? DEFAULT_WINDOW_PRESET_ID);
      els.push({
        kind: 'window',
        roomId: r.id,
        construction: 'окно',
        presetId: presetIdResolved,
        areaM2,
        count,
        orientation: w.orientation,
        openingWidthMm: wMm,
        openingHeightMm: hMm,
        name: `Окно ${w.id}`,
      });
    }
    return els;
  });

  const objectMetaResolved = objectMetaForCalcPayload(objectMeta, waterHeaterForm);

  return {
    building: {
      temps,
      objectMeta: objectMetaResolved,
      rooms: buildingRooms,
      envelopeElements,
    },
    heatingSystem: {
      hotWaterBoilerPowerMatchingScheme:
        waterHeaterForm.hotWaterBoilerPowerMatchingScheme,
      thermalRegimePreset,
      ...(ufhPresetId || waterUnderfloorHeating
        ? {
            waterUnderfloorHeating: true,
            underfloorDistributionPreset,
            ...(ufhPresetId
              ? {
                  ufhPresetId,
                  heatingEmittersMode:
                    ufhPresetId === 'ufh_only'
                      ? ('ufh_only' as const)
                      : ('mixed' as const),
                }
              : waterUnderfloorHeating
                ? { heatingEmittersMode: 'mixed' as const }
                : {}),
          }
        : {}),
    },
    hotWater: {
      residents: hotWaterForm.residents,
      coldWaterDesignSeason: hotWaterForm.coldWaterDesignSeason,
      hotWaterC: hotWaterForm.hotWaterC,
      tropicalShower: hotWaterForm.tropicalShower,
      fixtures: { ...hotWaterForm.fixtures },
    },
  };
}
