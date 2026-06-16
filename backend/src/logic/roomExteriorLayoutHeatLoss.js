/**
 * Назначение: поправки теплопотерь по положению комнаты (roomExteriorLayout).
 * Описание: Угловой множитель на wall/window, пониженный ΔT и U для стены в неотапливаемый корidor.
 */

import { heatLossFactorForEnvelopeKind, ORIENTATION_KINDS } from './orientationHeatLoss.js';

/** Совпадает с frontend INTERNAL_CORRIDOR_WALL_CONSTRUCTION. */
export const INTERNAL_CORRIDOR_WALL_CONSTRUCTION = 'стена в неотапливаемый коридор';

/** Множитель угловой комнаты (5–10 % к wall/window поверх β ориентации). */
export const CORNER_ROOM_HEAT_LOSS_FACTOR = 1.08;

/** Расчётная температура неотапливаемого коридора/подъезда, °C (зима). */
export const INTERNAL_CORRIDOR_DESIGN_TEMP_C = 15;

/** @type {ReadonlySet<string>} */
export const ROOM_EXTERIOR_LAYOUTS = new Set(['corner', 'facade', 'internal']);

/**
 * @param {string | null | undefined} construction
 * @returns {boolean}
 */
export function isInternalCorridorWallConstruction(construction) {
  return (
    String(construction ?? '')
      .trim()
      .toLowerCase() === INTERNAL_CORRIDOR_WALL_CONSTRUCTION.toLowerCase()
  );
}

/**
 * @param {string | null | undefined} construction
 * @returns {boolean}
 */
function isFacadeExteriorWallConstruction(construction) {
  const c = String(construction ?? '').trim().toLowerCase();
  if (!c) return true;
  if (isInternalCorridorWallConstruction(c)) return false;
  return c.includes('наруж') || c.includes('фасад') || c === 'wall';
}

/**
 * Подсчёт фасадных и корidorных стен комнаты во входе API.
 *
 * @param {import('../types/shared-types').EnvelopeElementInput[]} elements
 * @param {string} roomId
 * @returns {{ facadeWallCount: number, internalWallCount: number }}
 */
export function countExteriorWallsForRoom(elements, roomId) {
  let facadeWallCount = 0;
  let internalWallCount = 0;
  for (const el of elements ?? []) {
    if (!el || el.roomId !== roomId) continue;
    const kind = el.kind ?? null;
    if (kind != null && kind !== 'wall') continue;
    if (isInternalCorridorWallConstruction(el.construction)) {
      internalWallCount += 1;
    } else if (isFacadeExteriorWallConstruction(el.construction)) {
      facadeWallCount += 1;
    }
  }
  return { facadeWallCount, internalWallCount };
}

/**
 * Вывод layout по envelopeElements (legacy API без поля в room).
 *
 * @param {{ facadeWallCount: number, internalWallCount: number }} counts
 * @returns {'corner' | 'facade' | 'internal'}
 */
export function inferRoomExteriorLayoutFromWallCounts(counts) {
  if (counts.internalWallCount > 0 && counts.facadeWallCount === 0) {
    return 'internal';
  }
  if (counts.facadeWallCount >= 2) return 'corner';
  return 'facade';
}

/**
 * @param {import('../types/shared-types').RoomInput} room
 * @param {import('../types/shared-types').EnvelopeElementInput[]} elements
 * @returns {'corner' | 'facade' | 'internal'}
 */
export function resolveRoomExteriorLayout(room, elements) {
  const raw = room.roomExteriorLayout;
  if (typeof raw === 'string' && ROOM_EXTERIOR_LAYOUTS.has(raw)) {
    return /** @type {'corner' | 'facade' | 'internal'} */ (raw);
  }
  return inferRoomExteriorLayoutFromWallCounts(
    countExteriorWallsForRoom(elements, room.id),
  );
}

/**
 * ΔT для элемента ограждения.
 *
 * @param {object} args
 * @param {number} args.insideC
 * @param {number} args.outsideC
 * @param {string | null | undefined} args.construction
 * @returns {number}
 */
export function resolveElementDeltaT({ insideC, outsideC, construction }) {
  if (isInternalCorridorWallConstruction(construction)) {
    return insideC - INTERNAL_CORRIDOR_DESIGN_TEMP_C;
  }
  return insideC - outsideC;
}

/**
 * U для элемента (internal — тот же расчёт фасада из objectMeta; основной эффект — ΔT).
 *
 * @param {number | null | undefined} resolvedU
 * @param {string | null | undefined} _construction
 * @returns {number | null}
 */
export function resolveElementUValue(resolvedU, _construction) {
  return resolvedU ?? null;
}

/**
 * Итоговый heatLossFactor: β ориентации × множитель угловой комнаты.
 * Для стены в корidor — 1 (ориентация к улице не применяется).
 *
 * @param {object} args
 * @param {string | null | undefined} args.kind
 * @param {string | null | undefined} args.orientation
 * @param {string | null | undefined} args.construction
 * @param {'corner' | 'facade' | 'internal'} args.roomLayout
 * @returns {{ heatLossFactor: number, cornerRoomFactor: number }}
 */
export function resolveElementHeatLossFactors({
  kind,
  orientation,
  construction,
  roomLayout,
}) {
  if (isInternalCorridorWallConstruction(construction)) {
    return { heatLossFactor: 1, cornerRoomFactor: 1 };
  }

  const kindStr = String(kind ?? '');
  if (!ORIENTATION_KINDS.has(kindStr)) {
    return { heatLossFactor: 1, cornerRoomFactor: 1 };
  }

  const orientationFactor = heatLossFactorForEnvelopeKind(kindStr, orientation);
  if (roomLayout === 'corner') {
    return {
      heatLossFactor: orientationFactor * CORNER_ROOM_HEAT_LOSS_FACTOR,
      cornerRoomFactor: CORNER_ROOM_HEAT_LOSS_FACTOR,
    };
  }
  return { heatLossFactor: orientationFactor, cornerRoomFactor: 1 };
}

/**
 * Валидация согласованности layout и числа стен.
 *
 * @param {import('../types/shared-types').BuildingInput} building
 */
export function assertRoomExteriorLayoutWalls(building) {
  const rooms = building?.rooms ?? [];
  const elements = building?.envelopeElements ?? [];

  for (const room of rooms) {
    const layout = resolveRoomExteriorLayout(room, elements);
    const { facadeWallCount, internalWallCount } = countExteriorWallsForRoom(
      elements,
      room.id,
    );

    /** @type {string | null} */
    let message = null;

    if (layout === 'internal') {
      if (facadeWallCount > 0) {
        message = `Комната "${room.name}" (${room.id}): layout=internal, но задано фасадных стен: ${facadeWallCount}.`;
      } else if (internalWallCount !== 1) {
        message = `Комната "${room.name}" (${room.id}): layout=internal требует ровно одну стену в корidor, получено: ${internalWallCount}.`;
      }
    } else if (layout === 'facade') {
      if (internalWallCount > 0) {
        message = `Комната "${room.name}" (${room.id}): layout=facade не допускает стену в корidor.`;
      } else if (facadeWallCount !== 1) {
        message = `Комната "${room.name}" (${room.id}): layout=facade требует одну фасадную стену, получено: ${facadeWallCount}.`;
      }
    } else if (layout === 'corner') {
      if (internalWallCount > 0) {
        message = `Комната "${room.name}" (${room.id}): layout=corner не допускает стену в корidor.`;
      } else if (facadeWallCount !== 2) {
        message = `Комната "${room.name}" (${room.id}): layout=corner требует две фасадные стены, получено: ${facadeWallCount}.`;
      }
    }

    if (message) {
      const err = new Error(message);
      err.statusCode = 400;
      err.code = 'ROOM_EXTERIOR_LAYOUT_WALLS';
      throw err;
    }
  }
}

/**
 * Нормализация roomExteriorLayout на комнатах (если не задан — infer).
 *
 * @param {import('../types/shared-types').BuildingInput | undefined} building
 */
export function normalizeRoomExteriorLayouts(building) {
  if (!building?.rooms) return;
  const elements = building.envelopeElements ?? [];
  for (const room of building.rooms) {
    room.roomExteriorLayout = resolveRoomExteriorLayout(room, elements);
  }
}
