/**
 * Назначение: Нормализация поля underfloorHeating в комнатах.
 * Описание: Миграция legacy presetId → basePresetId + finishMaterialId.
 */

import {
  DEFAULT_UNDERFLOOR_HEATING_BASE_ID,
  LEGACY_MONOLITHIC_UFH_PRESET_MAP,
} from '../data/fallbackUnderfloorHeatingPresets';
import { DEFAULT_FLOORING_FINISH_ID } from '../data/fallbackFlooringFinishes';
import type { RoomFormValue, UfhPipeSpacingMm } from '../types/rooms';
import { DEFAULT_UFH_PIPE_SPACING_MM } from '../types/underfloorHeating';

export function migrateRoomUnderfloorHeating(rooms: RoomFormValue[]): RoomFormValue[] {
  return rooms.map((room) => {
    const ufh = room.underfloorHeating;
    if (!ufh) return room;
    if (!ufh.enabled) {
      const { underfloorHeating: _removed, ...rest } = room;
      return rest;
    }

    let basePresetId =
      typeof ufh.basePresetId === 'string' ? ufh.basePresetId.trim() : '';
    let finishMaterialId =
      typeof ufh.finishMaterialId === 'string' ? ufh.finishMaterialId.trim() : '';

    const legacyPresetId =
      typeof ufh.presetId === 'string' ? ufh.presetId.trim() : '';
    if ((!basePresetId || !finishMaterialId) && legacyPresetId) {
      const mapped = LEGACY_MONOLITHIC_UFH_PRESET_MAP[legacyPresetId];
      if (mapped) {
        basePresetId = mapped.basePresetId;
        finishMaterialId = mapped.finishMaterialId;
      }
    }

    if (!basePresetId) basePresetId = DEFAULT_UNDERFLOOR_HEATING_BASE_ID;
    if (!finishMaterialId) finishMaterialId = DEFAULT_FLOORING_FINISH_ID;

    const rawSpacing = ufh.pipeSpacingMm;
    const pipeSpacingMm: UfhPipeSpacingMm =
      rawSpacing === 100 || rawSpacing === 150 || rawSpacing === 200
        ? rawSpacing
        : DEFAULT_UFH_PIPE_SPACING_MM;

    return {
      ...room,
      underfloorHeating: { enabled: true, basePresetId, finishMaterialId, pipeSpacingMm },
    };
  });
}
