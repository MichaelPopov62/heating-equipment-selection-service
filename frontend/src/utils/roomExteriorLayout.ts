/**
 * Назначение: Положение помещения относительно наружного контура.
 * Описание: Угловое / фасад / внутреннее — число полей стен в UI и сборка envelopeElements.
 */

import type { ObjectType } from '../types/envelope';
import { createDefaultExternalWall } from './roomEnvelopeFields';
import type { ExternalWallFormValue, RoomFormValue, RoomType } from '../types/rooms';

/** Расположение помещения относительно наружного контура (дом и квартира). */
export type RoomExteriorLayout = 'corner' | 'facade' | 'internal';

/** Строка construction для стены в неотапливаемый коридор в API calc. */
export const INTERNAL_CORRIDOR_WALL_CONSTRUCTION = 'стена в неотапливаемый коридор';

const INTERNAL_ROOM_TYPES = new Set<RoomType>(['прихожая', 'коридор', 'тамбур']);

export type ExternalWallFieldConfig = {
  slot: 'externalWall1' | 'externalWall2';
  label: string;
  hint: string;
  placeholder: string;
};

/**
 * Дефолтное положение комнаты по типу помещения.
 * @param {RoomType} roomType
 * @returns {RoomExteriorLayout}
 */
export function defaultLayoutForRoomType(roomType: RoomType): RoomExteriorLayout {
  return INTERNAL_ROOM_TYPES.has(roomType) ? 'internal' : 'facade';
}

/**
 * Выводит layout из сохранённого поля или данных стен (миграция черновиков).
 * @param {RoomFormValue} room
 * @returns {RoomExteriorLayout}
 */
export function inferRoomExteriorLayout(room: RoomFormValue): RoomExteriorLayout {
  const stored = room.roomExteriorLayout;
  if (stored === 'corner' || stored === 'facade' || stored === 'internal') {
    return stored;
  }
  const wall2Area =
    typeof room.externalWall2?.areaM2 === 'number' && room.externalWall2.areaM2 > 0;
  if (wall2Area) return 'corner';
  return defaultLayoutForRoomType(room.type);
}

/**
 * Показывать ли вторую наружную стену.
 * @param {RoomExteriorLayout} layout
 * @returns {boolean}
 */
export function showSecondExternalWall(layout: RoomExteriorLayout): boolean {
  return layout === 'corner';
}

/**
 * Подпись блока стен над полями по layout и типу объекта.
 * @param {RoomExteriorLayout} layout
 * @param {ObjectType} objectType
 * @returns {string}
 */
export function exteriorWallsSectionHint(
  layout: RoomExteriorLayout,
  objectType: ObjectType,
): string {
  if (layout === 'internal') {
    return objectType === 'apartment'
      ? 'Укажите площадь и ориентацию стены в общий коридор подъезда. Фасадных угловых стен нет; U — по параметрам объекта.'
      : 'Укажите площадь и ориентацию стены в холодный коридор или тамбур. Фасадных угловых стен нет; U — по параметрам объекта.';
  }
  if (layout === 'facade') {
    return 'Укажите площадь и ориентацию одной наружной фасадной стены; U — по несущему слою и утеплителю объекта.';
  }
  return 'Укажите площади и ориентацию стен №1/№2; U — по несущему слою и утеплителю объекта.';
}

/**
 * Конфигурация полей стен для UI.
 * @param {RoomExteriorLayout} layout
 * @param {ObjectType} objectType
 * @returns {ExternalWallFieldConfig[]}
 */
export function externalWallFieldConfigs(
  layout: RoomExteriorLayout,
  objectType: ObjectType,
): ExternalWallFieldConfig[] {
  if (layout === 'internal') {
    const label =
      objectType === 'apartment'
        ? 'Стена в общий коридор подъезда'
        : 'Стена в холодный коридор / тамбур';
    return [
      {
        slot: 'externalWall1',
        label,
        hint:
          'Площадь стены на неотапливаемый коридор (без фасадных угловых стен). Окна на фасад обычно отсутствуют.',
        placeholder: 'например, 8',
      },
    ];
  }
  if (layout === 'facade') {
    return [
      {
        slot: 'externalWall1',
        label: 'Стена №1',
        hint: 'Наружная фасадная стена (чистая площадь без проёма окна).',
        placeholder: 'например, 20',
      },
    ];
  }
  return [
    {
      slot: 'externalWall1',
      label: 'Стена №1',
      hint: 'Основная наружная стена (чистая площадь без проёма окна).',
      placeholder: 'например, 20',
    },
    {
      slot: 'externalWall2',
      label: 'Стена №2',
      hint: 'Для угловой/торцевой комнаты — вторая наружная стена на другую сторону света.',
      placeholder: '0 — если одна стена',
    },
  ];
}

/**
 * Патч комнаты при смене layout (сброс второй стены).
 * @param {RoomExteriorLayout} layout
 * @param {ExternalWallFormValue} externalWall2
 * @returns {Partial<RoomFormValue>}
 */
export function patchRoomForLayoutChange(
  layout: RoomExteriorLayout,
  externalWall2: ExternalWallFormValue,
): Partial<RoomFormValue> {
  const patch: Partial<RoomFormValue> = { roomExteriorLayout: layout };
  if (!showSecondExternalWall(layout)) {
    const hasWall2 =
      typeof externalWall2.areaM2 === 'number' && externalWall2.areaM2 > 0;
    if (hasWall2) {
      patch.externalWall2 = createDefaultExternalWall();
    }
  }
  return patch;
}

export type WallEnvelopeEntry = {
  wall: ExternalWallFormValue;
  label: string;
  construction: string;
};

/**
 * Список стен для envelopeElements по layout комнаты.
 * @param {RoomFormValue} room
 * @returns {WallEnvelopeEntry[]}
 */
export function wallEnvelopeEntriesForRoom(room: RoomFormValue): WallEnvelopeEntry[] {
  const layout = inferRoomExteriorLayout(room);
  if (layout === 'corner') {
    return [
      {
        wall: room.externalWall1,
        label: 'Стена №1',
        construction: 'наружная стена',
      },
      {
        wall: room.externalWall2,
        label: 'Стена №2',
        construction: 'наружная стена',
      },
    ];
  }
  if (layout === 'internal') {
    return [
      {
        wall: room.externalWall1,
        label: 'Стена в коридор',
        construction: INTERNAL_CORRIDOR_WALL_CONSTRUCTION,
      },
    ];
  }
  return [
    {
      wall: room.externalWall1,
      label: 'Стена №1',
      construction: 'наружная стена',
    },
  ];
}
