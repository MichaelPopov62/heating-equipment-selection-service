/**
 * Назначение: Миграция типов помещений.
 * Описание: Приведение living/bathroom/tech и кириллических alias к каноническому справочнику.
 */

import { CANONICAL_ROOM_TYPES, LEGACY_ROOM_TYPE_MAP } from '../../../shared/roomTypeNormalization.js';
import type { RoomFormValue } from '../types/rooms';
import { warnCompatMigration } from './compatTelemetry';

const LEGACY = LEGACY_ROOM_TYPE_MAP as Readonly<
  Record<string, RoomFormValue['type']>
>;

/** Однократная миграция старых типов помещений (living и т.д.) → новый справочник. */
export function migrateLegacyRoomTypes(rooms: RoomFormValue[]): RoomFormValue[] {
  const allowed = new Set<string>([...CANONICAL_ROOM_TYPES]);
  let changed = false;
  const next = rooms.map((r) => {
    const t = r.type as string;
    const nt: RoomFormValue['type'] =
      LEGACY[t] ?? (allowed.has(t) ? (t as RoomFormValue['type']) : 'помещение');
    if (nt !== r.type) {
      changed = true;
      warnCompatMigration('RoomTypes', `${t} → ${nt} (roomId=${r.id})`);
    }
    return { ...r, type: nt };
  });
  return changed ? next : rooms;
}
