/**
 * Назначение: правило необходимости насосно-смесительного узла ТП.
 * Описание: isMixingNodeRequired = t_boiler_supply > t_floor_supply (одно сквозное правило).
 */

/**
 * @param {number | undefined | null} boilerSupplyC — подача котлового/радиаторного контура
 * @param {number} floorCircuitSupplyC — подача контура ТП по пресету финиша
 * @returns {boolean}
 */
export function isMixingNodeRequired(boilerSupplyC, floorCircuitSupplyC) {
  const boiler = Number(boilerSupplyC);
  const floor = Number(floorCircuitSupplyC);
  if (!Number.isFinite(boiler) || !Number.isFinite(floor)) return false;
  return boiler > floor;
}

/**
 * Агрегат по комнатам: смеситель нужен, если котёл горячее любого контура пола.
 *
 * @param {number | undefined | null} boilerSupplyC
 * @param {ReadonlyArray<{ circuitSupplyC: number }>} roomCircuits
 * @returns {boolean}
 */
export function isMixingNodeRequiredForProject(boilerSupplyC, roomCircuits) {
  if (!roomCircuits?.length) return false;
  return roomCircuits.some((r) =>
    isMixingNodeRequired(boilerSupplyC, r.circuitSupplyC),
  );
}
