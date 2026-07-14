/**
 * Назначение: Нормализация поля underfloorHeating в комнатах.
 * Описание: Миграция legacy presetId → basePresetId + finishMaterialId.
 */

import { DEFAULT_UNDERFLOOR_HEATING_BASE_ID } from '../data/fallbackUnderfloorHeatingPresets';
import { DEFAULT_FLOORING_FINISH_ID } from '../data/fallbackFlooringFinishes';
import type {
  RoomFormValue,
  UfhPipeSpacingMm,
  UfhTerminalControl,
} from '../types/rooms';
import { DEFAULT_UFH_PIPE_SPACING_MM } from '../types/underfloorHeating';
import { isRecord } from './jsonGuards';
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
  const next = rooms.map((room) => {
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

    // Совместимость: монолитный presetId читаем через Record, без deprecated-поля типа.
    const ufhRaw = ufh as unknown;
    const legacyPresetRaw =
      isRecord(ufhRaw) && typeof ufhRaw.presetId === 'string' ? ufhRaw.presetId.trim() : '';
    if ((!basePresetId || !finishMaterialId) && legacyPresetRaw) {
      const mapped = LEGACY_MONOLITHIC_UFH_PRESET_MAP[legacyPresetRaw];
      if (mapped) {
        basePresetId = mapped.basePresetId;
        finishMaterialId = mapped.finishMaterialId;
        warnCompatMigration(
          'RoomUfhPreset',
          `${legacyPresetRaw} → base+finish (roomId=${room.id})`,
        );
      }
    }

    if (!basePresetId) basePresetId = DEFAULT_UNDERFLOOR_HEATING_BASE_ID;
    if (!finishMaterialId) finishMaterialId = DEFAULT_FLOORING_FINISH_ID;

    const rawSpacing = ufh.pipeSpacingMm;
    const pipeSpacingMm: UfhPipeSpacingMm =
      rawSpacing === 100 || rawSpacing === 150 || rawSpacing === 200
        ? rawSpacing
        : DEFAULT_UFH_PIPE_SPACING_MM;

    const terminalRaw = ufh.ufhTerminalControl;
    const ufhTerminalControl: UfhTerminalControl | undefined =
      terminalRaw === 'unibox' ? 'unibox' : undefined;

    const furnitureOccupiedAreaM2 = ufh.furnitureOccupiedAreaM2;

    const normalized = {
      enabled: true as const,
      basePresetId,
      finishMaterialId,
      pipeSpacingMm,
      ...(furnitureOccupiedAreaM2 !== undefined
        ? { furnitureOccupiedAreaM2 }
        : {}),
      ...(ufhTerminalControl ? { ufhTerminalControl } : {}),
    };

    if (
      ufh.basePresetId === normalized.basePresetId &&
      ufh.finishMaterialId === normalized.finishMaterialId &&
      ufh.pipeSpacingMm === normalized.pipeSpacingMm &&
      ufh.ufhTerminalControl === normalized.ufhTerminalControl &&
      ufh.furnitureOccupiedAreaM2 === normalized.furnitureOccupiedAreaM2 &&
      !('presetId' in ufh)
    ) {
      return room;
    }

    return {
      ...room,
      underfloorHeating: normalized,
    };
  });
  return next.some((r, i) => r !== rooms[i]) ? next : rooms;
}
