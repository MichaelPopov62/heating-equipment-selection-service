/**
 * Назначение: проверка покрытия теплопотерь и активной площади ТП.
 * Описание: Только структурные статусы; тексты — recommendations.json.
 */

import { round } from '../utils/math.js';

/**
 * @param {object} args
 * @param {number} args.heatFluxUpWatts — полезная отдача ТП вверх, Вт
 * @param {number | undefined | null} args.roomHeatLossWatts
 * @returns {{ heatFluxCoverageRatio: number | null, coverageStatus: 'ok' | 'low' | 'unknown' }}
 */
export function assessUfhRoomHeatLossCoverage(args) {
  const { heatFluxUpWatts, roomHeatLossWatts } = args;
  const loss = Number(roomHeatLossWatts);

  if (!Number.isFinite(loss) || loss <= 0) {
    return { heatFluxCoverageRatio: null, coverageStatus: 'unknown' };
  }

  const ratio = heatFluxUpWatts / loss;
  return {
    heatFluxCoverageRatio: round(ratio, 3),
    coverageStatus: ratio < 0.95 ? 'low' : 'ok',
  };
}

/**
 * @param {object} args
 * @param {number} args.heatedAreaM2
 * @param {number | null} args.qRequiredWm2
 * @param {number} args.maxAllowableHeatFluxUpWm2
 * @returns {{ status: 'ok' | 'zero_heated_area' | 'insufficient_active_area' }}
 */
export function assessUfhActiveAreaHeatFlux(args) {
  const { heatedAreaM2, qRequiredWm2, maxAllowableHeatFluxUpWm2 } = args;

  if (!(heatedAreaM2 > 0)) {
    return { status: 'zero_heated_area' };
  }

  if (
    qRequiredWm2 != null
    && qRequiredWm2 > maxAllowableHeatFluxUpWm2 + 1e-6
  ) {
    return { status: 'insufficient_active_area' };
  }

  return { status: 'ok' };
}

/**
 * @param {import('../types/shared-types').HeatLossReport | undefined | null} heatLoss
 * @param {string} roomId
 * @returns {number | null}
 */
export function resolveRoomDesignHeatLossWatts(heatLoss, roomId) {
  const room = heatLoss?.rooms?.find((r) => r.id === roomId);
  if (!room) return null;
  if (typeof room.designWatts === 'number' && Number.isFinite(room.designWatts)) {
    return room.designWatts;
  }
  if (typeof room.envelopeWatts === 'number' && Number.isFinite(room.envelopeWatts)) {
    return room.envelopeWatts;
  }
  return null;
}
