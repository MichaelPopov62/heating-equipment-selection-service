/**
 * Назначение: активная площадь пола под укладку ТП (S_акт).
 * Описание: SSOT для heatedAreaM2; room.areaM2 не меняется (теплопотери).
 */

import { round } from '../utils/math.js';

/**
 * @param {object} args
 * @param {number} args.roomAreaM2 — полная площадь комнаты
 * @param {number} [args.furnitureOccupiedAreaM2] — S_meb, м²
 * @returns {{
 *   roomAreaM2: number,
 *   furnitureOccupiedAreaM2: number,
 *   heatedAreaM2: number,
 *   status: 'ok' | 'zero_heated_area',
 * }}
 */
export function resolveUfhActiveFloorAreaM2(args) {
  const roomAreaM2 = Math.max(0, Number(args.roomAreaM2) || 0);
  const furnitureOccupiedAreaM2 = Math.max(
    0,
    Number(args.furnitureOccupiedAreaM2) || 0,
  );
  const heatedAreaM2 = round(
    Math.max(0, roomAreaM2 - furnitureOccupiedAreaM2),
    4,
  );

  return {
    roomAreaM2,
    furnitureOccupiedAreaM2,
    heatedAreaM2,
    status: heatedAreaM2 > 0 ? 'ok' : 'zero_heated_area',
  };
}
