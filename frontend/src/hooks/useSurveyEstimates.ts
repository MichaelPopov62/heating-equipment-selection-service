/**
 * Назначение: Хук черновых оценок до ответа API.
 * Описание: Клиентские оценки теплопотерь и секций радиаторов для UI до расчёта.
 */

import { useMemo } from 'react';
import type { RoomFormValue } from '../types/rooms';
import {
  heatLossReserveKw,
  heatLossTotalKw,
  wattsToKilowatts,
} from '../utils/calculators/heatLoss';

/** Повнота блоку приміщень (площа та висота числом > 0). */
export function useSurveyEstimates(rooms: RoomFormValue[]) {
  const isRoomsComplete = useMemo(() => {
    if (rooms.length === 0) return false;
    return rooms.every(
      (r) =>
        typeof r.areaM2 === 'number'
        && r.areaM2 > 0
        && typeof r.heightM === 'number'
        && r.heightM > 0,
    );
  }, [rooms]);

  const quickEstimate = useMemo(() => {
    if (!isRoomsComplete) {
      return {
        totalAreaM2: 0,
        heatLossKw: 0,
        reserveKw: 0,
        totalHeatKw: 0,
        hotWaterPeakFlowLitersPerSecond: 0,
        hotWaterPowerKilowatts: 0,
        radiatorsSections: 0,
        boilerKw: 0,
      };
    }

    const totalAreaM2 = rooms.reduce((sum, r) => sum + (r.areaM2 as number), 0);
    // Чернеткова оцінка для UI (100 Вт/м²) до повного розрахунку по огородженнях.
    const heatLossKw = wattsToKilowatts(totalAreaM2 * 100);
    const reserveKw = heatLossReserveKw(heatLossKw);
    const totalHeatKw = heatLossTotalKw(heatLossKw);
    const hotWaterPeakFlowLitersPerSecond = 0;
    const hotWaterPowerKilowatts = 0;
    const boilerKw = totalHeatKw;
    const radiatorsSections = Math.ceil((totalHeatKw * 1000) / 150);

    return {
      totalAreaM2,
      heatLossKw,
      reserveKw,
      totalHeatKw,
      hotWaterPeakFlowLitersPerSecond,
      hotWaterPowerKilowatts,
      radiatorsSections,
      boilerKw,
    };
  }, [isRoomsComplete, rooms]);

  return { isRoomsComplete, quickEstimate };
}
