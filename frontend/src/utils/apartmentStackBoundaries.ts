/**
 * Назначение: Границы квартиры в стояке МКД.
 * Описание: Правила topBoundary/floor и id пресетов перекрытий для квартиры.
 */

import type { ApartmentStackPosition } from '../types/envelope';
import type { BottomBoundaryType, TopBoundaryType } from '../types/rooms';

export const PRESET_FLOOR_INTERSTORY_APARTMENT = 'floor_interstory_apartment';
export const PRESET_CEILING_INTERSTORY_APARTMENT = 'ceiling_interstory_apartment';
export const PRESET_FLOOR_APT_OVER_COLD_BELOW = 'floor_apt_over_cold_below';
export const PRESET_CEILING_APT_UNDER_ATTIC = 'ceiling_apt_under_attic';

export function normalizeApartmentStackPosition(
  v: string | undefined,
): ApartmentStackPosition {
  if (v === 'first_floor' || v === 'middle_floor' || v === 'last_floor') return v;
  return 'middle_floor';
}

export function resolveApartmentRoomBoundaries(
  stack: ApartmentStackPosition,
  roomFloor: number,
  objectFloors: number,
): { bottomBoundary: BottomBoundaryType; topBoundary: TopBoundaryType } {
  const f = Math.max(1, Math.min(3, Math.trunc(roomFloor) || 1));
  const maxF = Math.max(1, Math.min(3, Math.trunc(objectFloors) || 1));

  if (stack === 'first_floor') {
    return { bottomBoundary: 'unheated', topBoundary: 'heated' };
  }
  if (stack === 'middle_floor') {
    return { bottomBoundary: 'heated', topBoundary: 'heated' };
  }
  return {
    bottomBoundary: 'heated',
    topBoundary: f < maxF ? 'heated' : 'unheated',
  };
}

export function recommendedApartmentEnvelopePresets(
  bottomBoundary: BottomBoundaryType,
  topBoundary: TopBoundaryType,
): { floorPresetId: string; ceilingPresetId: string } {
  return {
    floorPresetId:
      bottomBoundary === 'unheated'
        ? PRESET_FLOOR_APT_OVER_COLD_BELOW
        : PRESET_FLOOR_INTERSTORY_APARTMENT,
    ceilingPresetId:
      topBoundary === 'unheated'
        ? PRESET_CEILING_APT_UNDER_ATTIC
        : PRESET_CEILING_INTERSTORY_APARTMENT,
  };
}

export function defaultHouseBottomBoundary(roomFloor: number): BottomBoundaryType {
  return Math.max(1, Math.trunc(roomFloor) || 1) <= 1 ? 'unheated' : 'heated';
}
