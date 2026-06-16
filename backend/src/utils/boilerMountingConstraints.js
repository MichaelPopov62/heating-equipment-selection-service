/**
 * Назначение: ограничения монтажа котла и объёма котельной.
 * Описание: Фильтрация настенных/напольных моделей по типу объекта, зоне размещения и нормам из appliances.boiler.mounting.
 */

import { getAppliances } from '../dhw/referenceCache.js';

/** @returns {import('../dhw/types').BoilerApplianceRules['mounting']} */
function boilerMounting() {
  return getAppliances().byKind.boiler.mounting;
}

/** Канонический type комнаты «котельная» в анкете (rooms[].type). */
export function getBoilerRoomType() {
  return boilerMounting().boilerRoomType;
}

/** @typedef {'kitchen' | 'living_zone' | 'boiler_room'} BoilerPlacementZone */

/** @typedef {'wall' | 'floor'} BoilerMountingType */

/**
 * @param {import('../types/shared-types').BuildingObjectMeta | undefined} objectMeta
 * @returns {'house' | 'apartment'}
 */
export function resolveObjectType(objectMeta) {
  return objectMeta?.objectType === 'apartment' ? 'apartment' : 'house';
}

/**
 * @param {import('../types/shared-types').BuildingInput | undefined} building
 * @param {import('../types/shared-types').BuildingObjectMeta | undefined} objectMeta
 * @returns {{ volumeM3: number, heightM: number, source: 'room' | 'meta' } | null}
 */
export function resolveBoilerRoomMetrics(building, objectMeta) {
  const boilerRoomType = getBoilerRoomType();
  const rooms = building?.rooms;
  if (Array.isArray(rooms)) {
    /** @type {{ volumeM3: number, heightM: number, source: 'room' } | null} */
    let best = null;
    for (const r of rooms) {
      if (!r || r.type !== boilerRoomType) continue;
      const area = Number(r.areaM2);
      const height = Number(r.heightM);
      if (!Number.isFinite(area) || !Number.isFinite(height) || area <= 0 || height <= 0) {
        continue;
      }
      const volumeM3 = area * height;
      if (!best || volumeM3 > best.volumeM3) {
        best = { volumeM3, heightM: height, source: 'room' };
      }
    }
    if (best) return best;
  }

  const area = objectMeta?.boilerRoomAreaM2;
  const height = objectMeta?.ceilingHeightM;
  if (area != null && height != null) {
    const a = Number(area);
    const h = Number(height);
    if (Number.isFinite(a) && Number.isFinite(h) && a > 0 && h > 0) {
      return { volumeM3: a * h, heightM: h, source: 'meta' };
    }
  }

  return null;
}

/**
 * @param {{ volumeM3: number, heightM: number } | null | undefined} metrics
 * @returns {boolean}
 */
export function isBoilerRoomVolumeCompliant(metrics) {
  if (!metrics) return false;
  const m = boilerMounting();
  return (
    metrics.heightM >= m.minBoilerRoomHeightM && metrics.volumeM3 >= m.minBoilerRoomVolumeM3
  );
}

/**
 * Подходит ли котёл из каталога под объект (монтаж + зона; объём котельной — на входе API).
 *
 * @param {import('../types/shared-types').BuildingObjectMeta | undefined} objectMeta
 * @param {import('../catalog/types').BoilerCatalogItemNormalized} boiler
 * @param {import('../types/shared-types').BuildingInput | undefined} [building]
 * @returns {boolean}
 */
export function checkMountingConstraints(objectMeta, boiler, building = undefined) {
  const objectType = resolveObjectType(objectMeta);
  const mt = boiler.mountingType;
  const m = boilerMounting();

  if (objectType === 'apartment') {
    if (mt === 'floor') return false;
    const maxKw = Number(boiler.powerKw?.max ?? 0);
    if (maxKw > m.maxApartmentNominalKw) return false;
    return true;
  }

  if (mt === 'floor') {
    if (objectMeta?.boilerPlacementZone !== 'boiler_room') return false;
    return isBoilerRoomVolumeCompliant(resolveBoilerRoomMetrics(building, objectMeta));
  }

  return true;
}

/**
 * @param {import('../catalog/types').BoilerCatalogItemNormalized[]} boilers
 * @param {import('../types/shared-types').BuildingObjectMeta | undefined} objectMeta
 * @param {import('../types/shared-types').BuildingInput | undefined} [building]
 * @returns {import('../catalog/types').BoilerCatalogItemNormalized[]}
 */
export function filterBoilersByMountingConstraints(boilers, objectMeta, building = undefined) {
  if (!boilers?.length) return [];
  return boilers.filter((b) => checkMountingConstraints(objectMeta, b, building));
}
