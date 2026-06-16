/**
 * Назначение: Клиентские формулы теплопотерь.
 * Описание: Запас 15 % и перевод ватт в киловатты для черновых оценок UI.
 */

export const HEAT_LOSS_RESERVE_FACTOR = 0.15;

/** Перевести Вт у кВт. */
export function wattsToKilowatts(watts: number): number {
  return watts / 1000;
}

/** Запас 15 % від базових теплопотерь у кВт. */
export function heatLossReserveKw(heatLossKw: number): number {
  return heatLossKw * HEAT_LOSS_RESERVE_FACTOR;
}

/** Теплопотери + запас 15 %. */
export function heatLossTotalKw(heatLossKw: number): number {
  return heatLossKw * (1 + HEAT_LOSS_RESERVE_FACTOR);
}
