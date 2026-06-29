/**
 * Назначение: требуемый удельный тепловой поток ТП на активной зоне.
 * Описание: q_треб = Q_потерь / S_акт.
 */

import { round } from '../utils/math.js';

/**
 * @param {object} args
 * @param {number | null | undefined} args.roomHeatLossWatts
 * @param {number} args.heatedAreaM2
 * @returns {number | null} Вт/м²
 */
export function computeUfhRequiredHeatFluxUpWm2(args) {
  const loss = Number(args.roomHeatLossWatts);
  const heatedAreaM2 = Number(args.heatedAreaM2);

  if (!Number.isFinite(loss) || loss <= 0) return null;
  if (!Number.isFinite(heatedAreaM2) || heatedAreaM2 <= 0) return null;

  return round(loss / heatedAreaM2, 1);
}
