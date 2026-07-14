/**
 * Назначение: чтение полей каталога БКН.
 * Описание: единые аксессоры specs (объём бака, мощность змеевика, minSourcePowerKw) без побочных
 * эффектов; используются в indirectWaterHeater.js и boiler.js.
 */

/**
 * Объём бака из позиции каталога БКН.
 * @param {import('../../catalog/types.js').IndirectWaterHeaterCatalogItemNormalized | null | undefined} item
 * @returns {number}
 */
export function indirectTankVolumeLiters(item) {
  const v = item?.specs?.volumeLiters;
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * Номинальная мощность теплообменника (змеевика), кВт.
 * @param {import('../../catalog/types.js').IndirectWaterHeaterCatalogItemNormalized | null | undefined} item
 * @returns {number | null}
 */
export function indirectCoilPowerKw(item) {
  const p = item?.specs?.powerKw;
  return typeof p === 'number' && Number.isFinite(p) && p > 0 ? p : null;
}

/**
 * Паспортная минимальная мощность источника для БКН (кВт), если задана в каталоге.
 * Used in: boiler.js (pre-match - порог requiredKw для схемы 1К+БКН);
 *          indirectWaterHeater.js (post-match - warning в attachIndirectBoilerCoupling).
 *
 * @param {import('../../catalog/types.js').IndirectWaterHeaterCatalogItemNormalized | null | undefined} item
 * @returns {number | null}
 */
export function indirectMinSourcePowerKw(item) {
  if (!item) return null;
  const p = item.specs?.minSourcePowerKw;
  return typeof p === 'number' && Number.isFinite(p) && p > 0 ? p : null;
}
