/**
 * Назначение: публичный API домена reference.
 * Описание: barrel-модуль runtime — bundle, CalcRuntimeContext и прогрев кэша справочников.
 */
export { getReferenceBundle, warmupReferenceCache, invalidateReferenceCache, invalidateAndWarmReferenceCache } from './configCache.js';
export { toCalcRuntimeContext } from './toCalcRuntimeContext.js';
export { assertCalcRuntimeContext } from './assertCalcRuntimeContext.js';
