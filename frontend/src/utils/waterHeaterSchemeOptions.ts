/**
 * Назначение: Доступные схемы подбора водонагревателя/ГВС.
 * Описание: Фильтрация опций UI и проверка «большой квартиры» для схемы 1К+БКН.
 */

import type { ObjectType } from '../types/envelope';
import type { HotWaterFormFixtures } from '../types/hotWater';
import {
  HOT_WATER_BOILER_POWER_MATCHING_SCHEME_OPTIONS,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
} from '../types/heatingMatching';
import type { RoomFormValue } from '../types/rooms';

/**
 * Квартира считается «крупной», если доступна схема 1К+БКН в UI
 * (площадь > 50 м² или ≥ 2 санузла / точки ванна+душ).
 */
export function isApartmentLargeForIndirectScheme(
  objectType: ObjectType,
  rooms: RoomFormValue[],
  fixtures: HotWaterFormFixtures,
): boolean {
  if (objectType !== 'apartment') return false;
  const totalArea = rooms.reduce((s, r) => s + (Number(r.areaM2) || 0), 0);
  const bathRooms = rooms.filter((r) => {
    const t = r.type.toLowerCase();
    return t === 'bathroom' || t.includes('сануз');
  }).length;
  const bathPoints = fixtures.bath + fixtures.shower;
  return totalArea > 50 || Math.max(bathRooms, bathPoints) >= 2;
}

/**
 * Список схем для селекта на шаге «Водонагреватель».
 * В малой квартире схема 1К+БКН скрыта (на бэкенде всё равно нормализуется).
 */
export function getWaterHeaterSchemeOptions(
  objectType: ObjectType,
  apartmentLarge: boolean,
) {
  if (objectType === 'apartment' && !apartmentLarge) {
    return HOT_WATER_BOILER_POWER_MATCHING_SCHEME_OPTIONS.filter(
      (o) => o.value !== SCHEME_BOILER_SINGLE_INDIRECT_SUM,
    );
  }
  return HOT_WATER_BOILER_POWER_MATCHING_SCHEME_OPTIONS;
}
