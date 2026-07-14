/**
 * Назначение: Хелперы полей ограждений комнаты.
 * Описание: Ориентации, нормализация layout и compat-миграция wallAreaM2.
 */

import type {
  BottomBoundaryType,
  ExternalWallFormValue,
  RoomFormValue,
  WindowOrientation,
} from '../types/rooms';
import { defaultHouseBottomBoundary } from './apartmentStackBoundaries';
import { warnCompatMigration } from './compatTelemetry';
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

/**
 * Комната в формате старого черновика (до externalWall1/2 и с возможными
 * произвольными строками для границ).
 */
type RoomFormCompat = Omit<
  RoomFormValue,
  'bottomBoundaryType' | 'externalWall1' | 'externalWall2'
> & {
  bottomBoundaryType?: string;
  externalWall1?: ExternalWallFormValue;
  externalWall2?: ExternalWallFormValue | null;
  wallAreaM2?: number | '';
};

/**
 * Нормализует нижнюю границу; для легаси-значений вне heated|unheated — дефолт по этажу.
 */
function resolveBottomBoundaryType(
  bottom: string | undefined,
  floor: RoomFormValue['floor'],
): BottomBoundaryType {
  if (bottom === 'heated' || bottom === 'unheated') return bottom;
  return defaultHouseBottomBoundary(floor);
}

/**
 * Compat: миграция wallAreaM2 → externalWall1/externalWall2.
 *
 * @param rooms
 */
function migrateLegacyWallAreaM2(rooms: RoomFormCompat[]): RoomFormValue[] {
  const next = rooms.map((room) => {
    if (!('wallAreaM2' in room)) {
      return room as RoomFormValue;
    }

    warnCompatMigration('RoomWallAreaM2', `roomId=${room.id}`);

    const wallArea =
      typeof room.wallAreaM2 === 'number' && room.wallAreaM2 > 0
        ? room.wallAreaM2
        : '';
    const { wallAreaM2: _drop, ...rest } = room;
    void _drop;

    const wall1 = rest.externalWall1;

    return {
      ...rest,
      externalWall1:
        wall1 != null && typeof wall1.areaM2 === 'number' && wall1.areaM2 > 0
          ? wall1
          : { areaM2: wallArea, orientation: 'N' as const },
      externalWall2: rest.externalWall2 ?? createDefaultExternalWall(),
      bottomBoundaryType: resolveBottomBoundaryType(
        rest.bottomBoundaryType,
        rest.floor,
      ),
    } satisfies RoomFormValue;
  });
  return next.some((r, i) => r !== rooms[i]) ? next : (rooms as RoomFormValue[]);
}

/**
 * Нормализация layout и границ пола (живая логика, не только compat).
 *
 * @param rooms
 */
function normalizeRoomEnvelopeFields(
  rooms: RoomFormValue[],
): RoomFormValue[] {
  const next = rooms.map((room) => {
    const patch: Partial<RoomFormValue> = {};
    // Рантайм-compat: после JSON-cast граница может быть произвольной строкой.
    const bottomRaw: string | undefined = (room as RoomFormCompat).bottomBoundaryType;
    if (bottomRaw !== 'heated' && bottomRaw !== 'unheated') {
      patch.bottomBoundaryType = defaultHouseBottomBoundary(room.floor);
    }
    const inferredLayout = inferRoomExteriorLayout(room);
    if (room.roomExteriorLayout !== inferredLayout) {
      patch.roomExteriorLayout = inferredLayout;
    }
    if (
      !showSecondExternalWall(inferredLayout) &&
      typeof room.externalWall2.areaM2 === 'number' &&
      room.externalWall2.areaM2 > 0
    ) {
      patch.externalWall2 = createDefaultExternalWall();
    }
    if (Object.keys(patch).length === 0) return room;
    return { ...room, ...patch };
  });
  return next.some((r, i) => r !== rooms[i]) ? next : rooms;
}

/**
 * Полный проход: compat wallAreaM2 + нормализация layout.
 *
 * @param rooms
 */
export function migrateRoomEnvelopeFields(
  rooms: RoomFormValue[],
): RoomFormValue[] {
  return normalizeRoomEnvelopeFields(migrateLegacyWallAreaM2(rooms));
}
