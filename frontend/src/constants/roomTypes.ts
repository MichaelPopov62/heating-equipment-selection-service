/**
 * Назначение: UI-справочник типов помещений.
 * Описание: Канонические значения — shared/roomTypeNormalization.js; здесь только подписи для селекта.
 * Select и onChange принимают исключительно CANONICAL_ROOM_TYPES (без legacy living/bathroom).
 */

import { CANONICAL_ROOM_TYPES } from '../../../shared/roomTypeNormalization.js';
import type { RoomType } from '../types/rooms';

const CANONICAL_ROOM_TYPE_SET: ReadonlySet<string> = new Set(CANONICAL_ROOM_TYPES);

/** Подписи для `<select>` типа помещения (порядок = CANONICAL_ROOM_TYPES). */
const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  прихожая: 'Прихожая',
  тамбур: 'Тамбур / входная зона',
  гостиная: 'Гостиная',
  коридор: 'Коридор',
  спальня: 'Спальня',
  кухня: 'Кухня',
  санузел: 'Санузел',
  тех: 'Техническое',
  котельная: 'Котельная',
  помещение: 'Помещение',
};

/**
 * Проверка канонического типа помещения (SSOT = shared CANONICAL_ROOM_TYPES).
 *
 * @param v
 */
export function isCanonicalRoomType(v: unknown): v is RoomType {
  return typeof v === 'string' && CANONICAL_ROOM_TYPE_SET.has(v);
}

/**
 * Разбор значения из `<select>`: только канон, иначе null.
 *
 * @param v
 */
export function parseCanonicalRoomTypeFromSelect(v: string): RoomType | null {
  const trimmed = v.trim();
  return isCanonicalRoomType(trimmed) ? trimmed : null;
}

/** Опции селекта «тип помещения» — только канонические значения (без legacy living/bathroom). */
export const ROOM_TYPE_UI_OPTIONS: ReadonlyArray<{ value: RoomType; label: string }> =
  CANONICAL_ROOM_TYPES.map((value) => {
    if (!isCanonicalRoomType(value)) {
      throw new Error(`ROOM_TYPE_UI_OPTIONS: неканонический type «${value}»`);
    }
    return {
      value,
      label: ROOM_TYPE_LABELS[value],
    };
  });
