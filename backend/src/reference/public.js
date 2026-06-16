/**
 * Назначение: публичный API домена reference.
 * Описание: barrel-модуль runtime — экспортирует getReferenceBundle и warmupReferenceCache
 * для согласованного набора catalog + water_norms + appliances + recommendations.
 */
export { getReferenceBundle, warmupReferenceCache } from './configCache.js';
