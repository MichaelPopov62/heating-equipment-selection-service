/**
 * Назначение: синхронный кэш underfloor_heating_presets.
 * Описание: Обновляется configCache.js; для validate и warmFloor при calc.
 */
/** @type {import('./types').UnderfloorHeatingPresetsBundle | null} */
let cachedUfhPresets = null;

/** @type {'file' | 'mongo' | null} */
let cachedSource = null;

/**
 * @param {import('./types').UnderfloorHeatingPresetsBundle} bundle
 * @param {'file' | 'mongo'} source
 */
export function setUfhPresetsCache(bundle, source) {
  cachedUfhPresets = bundle;
  cachedSource = source;
}

/** @returns {import('./types').UnderfloorHeatingPresetsBundle} */
export function getUfhPresets() {
  if (!cachedUfhPresets) {
    throw new Error(
      'Справочник underfloor_heating_presets не загружен. Вызовите warmupReferenceCache() / getReferenceBundle().',
    );
  }
  return cachedUfhPresets;
}

/** @returns {'file' | 'mongo'} */
export function getUfhPresetsSource() {
  if (!cachedSource) {
    throw new Error(
      'Источник underfloor_heating_presets не задан. Вызовите warmupReferenceCache().',
    );
  }
  return cachedSource;
}
