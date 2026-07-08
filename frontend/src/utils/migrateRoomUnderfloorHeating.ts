/**
 * Назначение: Нормализация поля underfloorHeating в комнатах.
 * Описание: Миграция legacy presetId → basePresetId + finishMaterialId.
 */

import { DEFAULT_UNDERFLOOR_HEATING_BASE_ID } from '../data/fallbackUnderfloorHeatingPresets';
import { DEFAULT_FLOORING_FINISH_ID } from '../data/fallbackFlooringFinishes';
import type { RoomFormValue, UfhPipeSpacingMm } from '../types/rooms';
import { DEFAULT_UFH_PIPE_SPACING_MM } from '../types/underfloorHeating';
import { warnCompatMigration } from './compatTelemetry';

/** Миграция устаревших монолитных presetId → base + finish (только compat). */
const LEGACY_MONOLITHIC_UFH_PRESET_MAP: Record<
  string,
  { basePresetId: string; finishMaterialId: string }
> = {
  underfloor_heating_glued_pvc_quartz_vinyl_interstory: {
    basePresetId: DEFAULT_UNDERFLOOR_HEATING_BASE_ID,
    finishMaterialId: 'pvc_glue',
  },
  underfloor_heating_floating_quartz_vinyl_interstory: {
    basePresetId: DEFAULT_UNDERFLOOR_HEATING_BASE_ID,
    finishMaterialId: 'pvc_click',
  },
};

export function migrateRoomUnderfloorHeating(rooms: RoomFormValue[]): RoomFormValue[] {
  let changed = false;
  const next = rooms.map((room) => {
    const ufh = room.underfloorHeating;
    if (!ufh) return room;
    if (!ufh.enabled) {
      if (!('underfloorHeating' in room)) return room;
      changed = true;
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
        warnCompatMigration('RoomUfhPreset', `${legacyPresetId} → base+finish (roomId=${room.id})`);
        changed = true;
      }
    }

    if (!basePresetId) basePresetId = DEFAULT_UNDERFLOOR_HEATING_BASE_ID;
    if (!finishMaterialId) finishMaterialId = DEFAULT_FLOORING_FINISH_ID;

    const rawSpacing = ufh.pipeSpacingMm;
    const pipeSpacingMm: UfhPipeSpacingMm =
      rawSpacing === 100 || rawSpacing === 150 || rawSpacing === 200
        ? rawSpacing
        : DEFAULT_UFH_PIPE_SPACING_MM;

    const normalized = {
      enabled: true as const,
      basePresetId,
      finishMaterialId,
      pipeSpacingMm,
    };

    if (
      room.underfloorHeating?.basePresetId !== normalized.basePresetId ||
      room.underfloorHeating?.finishMaterialId !== normalized.finishMaterialId ||
      room.underfloorHeating?.pipeSpacingMm !== normalized.pipeSpacingMm
    ) {
      changed = true;
    }

    return {
      ...room,
      underfloorHeating: normalized,
    };
  });
  return changed ? next : rooms;
}
