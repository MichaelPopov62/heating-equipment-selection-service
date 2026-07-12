/**
 * Назначение: единый resolve расчётной T воздуха помещения (не теплоноситель).
 * Описание: smart fallback без обязательного per-room поля в анкете.
 * Санузел: max(bathroomAirTempC ?? insideC, 24). Остальные типы: insideC.
 */

/** Канонический тип влажного помещения. */
export const BATHROOM_ROOM_TYPE = 'санузел';

/**
 * Пол расчётной T воздуха для санузла, °C.
 * Ниже не принимаем (AJV minimum для bathroomAirTempC; resolve поднимает candidate).
 */
export const BATHROOM_DESIGN_AIR_TEMP_FLOOR_C = 24;

/**
 * Типы малих зон ТП (часто 1 петля / унібокс) — сценарій, не окремі T.
 * @type {readonly string[]}
 */
export const SMALL_ZONE_ROOM_TYPES = Object.freeze([
  'санузел',
  'коридор',
  'прихожая',
  'тамбур',
]);

/**
 * @typedef {'survey' | 'bathroom_field' | 'floor'} DesignRoomAirTempSource
 */

/**
 * @typedef {object} DesignRoomAirTempResolved
 * @property {number} designAirTempC — розрахункова T повітря приміщення, °C
 * @property {DesignRoomAirTempSource} source
 */

/**
 * Резолв розрахункової T повітря для кімнати.
 *
 * @param {object} args
 * @param {string | undefined | null} args.roomType — канонічний room.type
 * @param {number} args.insideC — temps.insideC з анкети
 * @param {number | undefined | null} [args.bathroomAirTempC] — temps.bathroomAirTempC (≥ 24)
 * @returns {DesignRoomAirTempResolved | null} null, якщо insideC не finite
 */
export function resolveDesignRoomAirTempC({ roomType, insideC, bathroomAirTempC } = {}) {
  const survey = Number(insideC);
  if (!Number.isFinite(survey)) return null;

  const type = String(roomType ?? '')
    .trim()
    .toLowerCase();

  if (type !== BATHROOM_ROOM_TYPE) {
    return { designAirTempC: survey, source: 'survey' };
  }

  const bathField =
    bathroomAirTempC != null && bathroomAirTempC !== ''
      ? Number(bathroomAirTempC)
      : NaN;
  const hasBathField = Number.isFinite(bathField);
  const candidate = hasBathField ? bathField : survey;
  const designAirTempC = Math.max(candidate, BATHROOM_DESIGN_AIR_TEMP_FLOOR_C);

  if (hasBathField && bathField >= BATHROOM_DESIGN_AIR_TEMP_FLOOR_C) {
    return { designAirTempC, source: 'bathroom_field' };
  }
  if (candidate < BATHROOM_DESIGN_AIR_TEMP_FLOOR_C) {
    return { designAirTempC, source: 'floor' };
  }
  return { designAirTempC, source: 'survey' };
}

/**
 * @param {string | undefined | null} roomType
 * @returns {boolean}
 */
export function isSmallZoneRoomType(roomType) {
  const type = String(roomType ?? '')
    .trim()
    .toLowerCase();
  return SMALL_ZONE_ROOM_TYPES.includes(type);
}
