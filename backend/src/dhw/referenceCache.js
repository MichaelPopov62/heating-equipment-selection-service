/**
 * Назначение: синхронный кэш water_norms и appliances.
 * Описание: хранит последний снимок справочников для matching и логики расчёта; обновляется
 * configCache.js; для HTTP-роутов предпочтительнее getReferenceBundle().
 */
/** @type {import('./types').NormalizedWaterNorms | null} */
let cachedWaterNorms = null;

/** @type {import('./types').AppliancesBundle | null} */
let cachedAppliances = null;

/**
 * @param {import('./types').NormalizedWaterNorms} waterNorms
 * @param {'file' | 'mongo'} _source
 */
export function setWaterNormsCache(waterNorms, _source) {
  cachedWaterNorms = waterNorms;
  void _source;
}

/**
 * @param {import('./types').AppliancesBundle} appliances
 * @param {'file' | 'mongo'} _source
 */
export function setAppliancesCache(appliances, _source) {
  cachedAppliances = appliances;
  void _source;
}

/** @returns {import('./types').NormalizedWaterNorms} */
export function getWaterNorms() {
  if (!cachedWaterNorms) {
    throw new Error(
      'Справочник water_norms не загружен. Вызовите warmupReferenceCache() / getReferenceBundle().',
    );
  }
  return cachedWaterNorms;
}

/** @returns {import('./types').AppliancesBundle} */
export function getAppliances() {
  if (!cachedAppliances) {
    throw new Error(
      'Справочник appliances не загружен. Вызовите warmupReferenceCache() / getReferenceBundle().',
    );
  }
  return cachedAppliances;
}
