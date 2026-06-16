/**
 * Назначение: Хелперы полей ограждений комнаты.
 * Описание: Ориентации, миграция legacy-полей и расчёт площадей envelope.
 */

import type {
  ExternalWallFormValue,
  RoomFormValue,
  WindowOrientation,
} from '../types/rooms';
import { defaultHouseBottomBoundary } from './apartmentStackBoundaries';
import {
  inferRoomExteriorLayout,
  showSecondExternalWall,
} from './roomExteriorLayout';

/** Подписи сторон света для UI (СНiП / СП 60.13330). */
export const ORIENTATION_OPTIONS: ReadonlyArray<{
  code: WindowOrientation;
  label: string;
}> = [
  { code: 'N', label: 'С (N)' },
  { code: 'NE', label: 'СВ (NE)' },
  { code: 'E', label: 'В (E)' },
  { code: 'SE', label: 'ЮВ (SE)' },
  { code: 'S', label: 'Ю (S)' },
  { code: 'SW', label: 'ЮЗ (SW)' },
  { code: 'W', label: 'З (W)' },
  { code: 'NW', label: 'СЗ (NW)' },
];

/** Пустая наружная стена с ориентацией по умолчанию (север). */
export function createDefaultExternalWall(): ExternalWallFormValue {
  return { areaM2: '', orientation: 'N' };
}

/** Суммарная площадь наружных стен комнаты (для проверок UI). */
export function totalExternalWallAreaM2(room: RoomFormValue): number {
  const a1 =
    typeof room.externalWall1.areaM2 === 'number'
      ? room.externalWall1.areaM2
      : 0;
  const a2 =
    typeof room.externalWall2.areaM2 === 'number'
      ? room.externalWall2.areaM2
      : 0;
  return a1 + a2;
}

/** Легаси-поле анкеты до разбиения на externalWall1/2. */
type RoomFormLegacyFields = {
  wallAreaM2?: number | '';
};

/** Миграция старого поля wallAreaM2 → externalWall1/externalWall2. */
export function migrateRoomEnvelopeFields(
  rooms: RoomFormValue[],
): RoomFormValue[] {
  let changed = false;
  const next = rooms.map((room) => {
    const legacy = room as RoomFormValue & RoomFormLegacyFields;
    const patch: Partial<RoomFormValue> = {};
    if (
      room.bottomBoundaryType !== 'heated' &&
      room.bottomBoundaryType !== 'unheated'
    ) {
      patch.bottomBoundaryType = defaultHouseBottomBoundary(room.floor);
    }
    if (!('wallAreaM2' in legacy)) {
      const inferredLayout = inferRoomExteriorLayout(room);
      if (room.roomExteriorLayout !== inferredLayout) {
        patch.roomExteriorLayout = inferredLayout;
      }
      if (
        !showSecondExternalWall(inferredLayout) &&
        typeof room.externalWall2?.areaM2 === 'number' &&
        room.externalWall2.areaM2 > 0
      ) {
        patch.externalWall2 = createDefaultExternalWall();
      }
      if (Object.keys(patch).length > 0) {
        changed = true;
        return { ...room, ...patch };
      }
      return room;
    }

    changed = true;
    const wallArea =
      typeof legacy.wallAreaM2 === 'number' && legacy.wallAreaM2 > 0
        ? legacy.wallAreaM2
        : '';
    const rest = { ...legacy };
    delete rest.wallAreaM2;
    const hasWall1Area =
      typeof rest.externalWall1?.areaM2 === 'number' &&
      rest.externalWall1.areaM2 > 0;

    const migratedWall1: ExternalWallFormValue = hasWall1Area
      ? rest.externalWall1
      : { areaM2: wallArea, orientation: 'N' };

    return {
      ...rest,
      ...patch,
      externalWall1: migratedWall1,
      externalWall2: rest.externalWall2 ?? createDefaultExternalWall(),
      bottomBoundaryType:
        rest.bottomBoundaryType === 'heated' ||
        rest.bottomBoundaryType === 'unheated'
          ? rest.bottomBoundaryType
          : (patch.bottomBoundaryType ??
            defaultHouseBottomBoundary(rest.floor)),
    };
  });
  return changed ? next : rooms;
}
