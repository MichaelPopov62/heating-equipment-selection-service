/**
 * Назначение: UI-справочник типов помещений.
 * Описание: Канонические значения — shared/roomTypeNormalization.js; здесь только подписи для селекта.
 */

import { CANONICAL_ROOM_TYPES } from '../../../shared/roomTypeNormalization.js';
import type { RoomType } from '../types/rooms';

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

/** Опции селекта «тип помещения» — только канонические значения (без legacy living/bathroom). */
export const ROOM_TYPE_UI_OPTIONS: ReadonlyArray<{ value: RoomType; label: string }> =
  CANONICAL_ROOM_TYPES.map((value) => ({
    value: value as RoomType,
    label: ROOM_TYPE_LABELS[value as RoomType],
  }));
