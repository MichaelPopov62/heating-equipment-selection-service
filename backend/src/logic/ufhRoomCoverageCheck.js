/**
 * Назначение: проверка, покрывает ли теплоотдача ТП теплопотери комнаты.
 * Описание: Особенно важно для контура 40/30 с меньшим q↑.
 */

import { round } from '../utils/math.js';

/**
 * @param {object} args
 * @param {string} args.roomName
 * @param {number} args.heatFluxUpWatts — полезная отдача ТП вверх, Вт
 * @param {number | undefined | null} args.roomHeatLossWatts — designWatts или envelopeWatts из heatLoss
 * @returns {{ heatFluxCoverageRatio: number | null, warnings: string[] }}
 */
export function assessUfhRoomHeatLossCoverage(args) {
  const { roomName, heatFluxUpWatts, roomHeatLossWatts } = args;
  const loss = Number(roomHeatLossWatts);
  /** @type {string[]} */
  const warnings = [];

  if (!Number.isFinite(loss) || loss <= 0) {
    return { heatFluxCoverageRatio: null, warnings };
  }

  const ratio = heatFluxUpWatts / loss;
  if (ratio < 0.95) {
    warnings.push(
      `Комната «${roomName}»: отдача ТП ≈${round(heatFluxUpWatts, 0)} Вт не покрывает расчётные потери ≈${round(loss, 0)} Вт `
        + `(коэффициент ${round(ratio * 100, 0)} %). Уточните шаг трубы, покрытие или дополните отопление.`,
    );
  }

  return {
    heatFluxCoverageRatio: round(ratio, 3),
    warnings,
  };
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
