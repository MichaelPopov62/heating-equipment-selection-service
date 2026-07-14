/**
 * Назначение: адаптер T повітря для підбору унібокса (обгортка shared SSOT).
 * Опис: не дублює константи — делегує shared/roomDesignAirTemp.js.
 */

import {
  BATHROOM_DESIGN_AIR_TEMP_FLOOR_C,
  SMALL_ZONE_ROOM_TYPES,
  resolveDesignRoomAirTempC,
  isSmallZoneRoomType,
} from '../../../../shared/roomDesignAirTemp.js';

/** @deprecated використовуйте SMALL_ZONE_ROOM_TYPES з shared */
export const UNIBOX_SMALL_ZONE_ROOM_TYPES = SMALL_ZONE_ROOM_TYPES;

/**
 * Сумісність зі старим API (санузел → підлога 24).
 * Нова семантика: max(bathroomAirTempC ?? insideC, 24), не «завжди 24».
 * @type {Readonly<Record<string, number>>}
 */
export const UNIBOX_ROOM_AIR_TEMP_PRESETS_C = Object.freeze({
  санузел: BATHROOM_DESIGN_AIR_TEMP_FLOOR_C,
});

/**
 * @typedef {import('../../types/shared-types.js').UniboxRoomAirTempSource} UniboxRoomAirTempSource
 */

/**
 * @typedef {object} UniboxRoomAirTempResolved
 * @property {number} roomAirTempC
 * @property {UniboxRoomAirTempSource} roomAirTempSource
 */

/**
 * Резолв T повітря для унібокса.
 *
 * @param {string | undefined | null} roomType
 * @param {number} surveyInsideC
 * @param {number | undefined | null} [bathroomAirTempC]
 * @returns {UniboxRoomAirTempResolved | null}
 */
export function resolveUniboxRoomAirTempC(roomType, surveyInsideC, bathroomAirTempC) {
  const resolved = resolveDesignRoomAirTempC({
    ...(roomType !== undefined ? { roomType } : {}),
    insideC: surveyInsideC,
    ...(bathroomAirTempC !== undefined ? { bathroomAirTempC } : {}),
  });
  if (!resolved) return null;

  /** @type {'preset' | 'survey' | 'bathroom_field' | 'floor'} */
  let roomAirTempSource = 'survey';
  if (resolved.source === 'floor' || resolved.source === 'bathroom_field') {
    roomAirTempSource = resolved.source;
  } else if (
    String(roomType ?? '')
      .trim()
      .toLowerCase() === 'санузел' &&
    resolved.designAirTempC === BATHROOM_DESIGN_AIR_TEMP_FLOOR_C &&
    Number(surveyInsideC) < BATHROOM_DESIGN_AIR_TEMP_FLOOR_C
  ) {
    roomAirTempSource = 'floor';
  } else if (resolved.source === 'survey') {
    roomAirTempSource = 'survey';
  }

  // Сумісність з H.16b: «preset» = спрацювала підлога/поле санузла
  if (roomAirTempSource === 'floor' || roomAirTempSource === 'bathroom_field') {
    return {
      roomAirTempC: resolved.designAirTempC,
      roomAirTempSource:
        roomAirTempSource === 'bathroom_field' ? 'bathroom_field' : 'preset',
    };
  }

  return {
    roomAirTempC: resolved.designAirTempC,
    roomAirTempSource: 'survey',
  };
}

export { isSmallZoneRoomType as isUniboxSmallZoneRoomType };
