/**
 * Назначение: границы комнат квартиры в стояке МКД.
 * Описание: Определяет верхнюю и нижнюю границы комнат по положению квартиры (first/middle/last_floor) и этажу. Подбирает пресеты межэтажных перекрытий и предупреждает о несоответствии потолка. Используется в validate.js при нормализации анкеты квартиры.
 */

/** @typedef {'first_floor' | 'middle_floor' | 'last_floor'} ApartmentStackPosition */

const APARTMENT_STACK_POSITIONS = /** @type {const} */ ([
  'first_floor',
  'middle_floor',
  'last_floor',
]);

/** Потолок с U≈0.35 — если новый пресет недоступен в старых снимках. */
const PRESET_CEILING_APT_UNDER_ATTIC = 'ceiling_apt_under_attic';
const PRESET_CEILING_ATTIC_FALLBACK = 'ceiling_gkl_minwool_std';

/** Декоративный потолок — только при topBoundary=heated. */
const PRESET_CEILING_GKL_AIR_GAP = 'ceiling_gkl_air_gap';

/**
 * @param {unknown} v
 * @returns {ApartmentStackPosition}
 */
export function normalizeApartmentStackPosition(v) {
  const s = String(v ?? '').trim();
  if (/** @type {readonly string[]} */ (APARTMENT_STACK_POSITIONS).includes(s)) {
    return /** @type {ApartmentStackPosition} */ (s);
  }
  return 'middle_floor';
}

/**
 * @param {ApartmentStackPosition} stack
 * @param {number} roomFloor
 * @param {number} objectFloors
 * @returns {{ bottomBoundary: 'heated' | 'unheated', topBoundary: 'heated' | 'unheated' }}
 */
export function resolveApartmentRoomBoundaries(stack, roomFloor, objectFloors) {
  const f = Math.max(1, Math.min(3, Math.trunc(roomFloor) || 1));
  const maxF = Math.max(1, Math.min(3, Math.trunc(objectFloors) || 1));

  if (stack === 'first_floor') {
    return {
      bottomBoundary: 'unheated',
      topBoundary: 'heated',
    };
  }

  if (stack === 'middle_floor') {
    return {
      bottomBoundary: 'heated',
      topBoundary: 'heated',
    };
  }

  // last_floor в стояке здания: холод/чердак только над верхним уровнем квартиры
  return {
    bottomBoundary: 'heated',
    topBoundary: f < maxF ? 'heated' : 'unheated',
  };
}

/**
 * Нижняя граница для дома: 1-й этаж — холод снизу, выше — тёплый контур.
 *
 * @param {number} roomFloor
 * @returns {'heated' | 'unheated'}
 */
export function defaultHouseBottomBoundary(roomFloor) {
  const f = Math.max(1, Math.trunc(roomFloor) || 1);
  return f <= 1 ? 'unheated' : 'heated';
}

/**
 * @param {'heated' | 'unheated' | 'roof'} topBoundary
 * @param {string | undefined} ceilingPresetId
 * @returns {string | null}
 */
export function warnApartmentCeilingPresetMismatch(topBoundary, ceilingPresetId) {
  if (topBoundary !== 'unheated') return null;
  if (ceilingPresetId === PRESET_CEILING_GKL_AIR_GAP) {
    return (
      'Потолок ceiling_gkl_air_gap (U≈1.2) не подходит при холодной зоне сверху — выберите утеплённое перекрытие ' +
      `(например ${PRESET_CEILING_APT_UNDER_ATTIC} или ${PRESET_CEILING_ATTIC_FALLBACK}).`
    );
  }
  return null;
}
