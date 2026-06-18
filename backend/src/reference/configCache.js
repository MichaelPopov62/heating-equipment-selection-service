/**
 * Назначение: TTL-кэш справочного bundle.
 * Описание: согласованная загрузка catalog, water_norms, appliances и recommendations с прогревом
 * при старте API; обновление по REFERENCE_CACHE_TTL_MS; on-demand invalidate с generation guard.
 */
import { loadCatalog } from '../catalog/public.js';
import { loadWaterNorms } from '../dhw/loadWaterNorms.js';
import { loadAppliances } from '../dhw/loadAppliances.js';
import { loadRecommendations } from '../recommendations/loadRecommendations.js';
import { loadUnderfloorHeatingPresets } from '../ufh/loadUnderfloorHeatingPresets.js';
import { deepFreeze } from './deepFreeze.js';
import { logger } from '../utils/logger.js';

const DEFAULT_TTL_MS = 60 * 60 * 1000;

/**
 * @typedef {object} ReferenceBundle
 * @property {import('../catalog/types').NormalizedCatalog} catalog
 * @property {'file' | 'mongo'} catalogSource
 * @property {import('../dhw/types').NormalizedWaterNorms} waterNorms
 * @property {'file' | 'mongo'} waterNormsSource
 * @property {import('../dhw/types').AppliancesBundle} appliances
 * @property {'file' | 'mongo'} appliancesSource
 * @property {import('../recommendations/types').RecommendationsBundle} recommendations
 * @property {'file' | 'mongo'} recommendationsSource
 * @property {import('../ufh/types').UnderfloorHeatingPresetsBundle} ufhPresets
 * @property {'file' | 'mongo'} ufhPresetsSource
 * @property {number} loadedAt — timestamp (Date.now()) момента успешной загрузки
 */

/** @type {ReferenceBundle | null} */
let cachedBundle = null;

/** @type {Promise<ReferenceBundle> | null} */
let refreshInFlight = null;

/** Монотонный epoch: invalidate увеличивает; refresh пишет в кэш только при совпадении epoch. */
let cacheGeneration = 0;

/**
 * @returns {number}
 */
function resolveTtlMs() {
  const raw = Number(process.env.REFERENCE_CACHE_TTL_MS);
  if (Number.isFinite(raw) && raw > 0) return Math.trunc(raw);
  return DEFAULT_TTL_MS;
}

/**
 * @returns {Promise<ReferenceBundle>}
 */
async function loadReferenceBundleFresh() {
  const [
    { catalog, catalogSource },
    { waterNorms, waterNormsSource },
    { appliances, appliancesSource },
    { recommendations, recommendationsSource },
    { ufhPresets, ufhPresetsSource },
  ] = await Promise.all([
    loadCatalog(),
    loadWaterNorms(),
    loadAppliances(),
    loadRecommendations(),
    loadUnderfloorHeatingPresets(),
  ]);

  /** @type {ReferenceBundle} */
  const bundle = {
    catalog,
    catalogSource,
    waterNorms,
    waterNormsSource,
    appliances,
    appliancesSource,
    recommendations,
    recommendationsSource,
    ufhPresets,
    ufhPresetsSource,
    loadedAt: Date.now(),
  };

  deepFreeze(bundle);
  logger.info('referenceCache.loaded', null, {
    catalogSource,
    waterNormsSource,
    waterNormsSchemaVersion: waterNorms.schemaVersion,
    appliancesSource,
    recommendationsSource,
    recommendationCodes: Object.keys(recommendations.byCode),
    ufhPresetsSource,
    ufhPresetsSchemaVersion: ufhPresets.schemaVersion,
    loadedAt: new Date(bundle.loadedAt).toISOString(),
    generation: cacheGeneration,
  });

  return bundle;
}

/**
 * Сброс in-memory снимка (on-demand). Orphan refresh не отменяется, но не перезапишет кэш
 * благодаря cacheGeneration.
 */
export function invalidateReferenceCache() {
  cacheGeneration += 1;
  cachedBundle = null;
  refreshInFlight = null;
  logger.info('referenceCache.invalidated', null, { generation: cacheGeneration });
}

/**
 * Invalidate + eager reload — для webhook после seed/правки справочников в Mongo.
 *
 * @returns {Promise<ReferenceBundle>}
 */
export async function invalidateAndWarmReferenceCache() {
  invalidateReferenceCache();
  return warmupReferenceCache();
}

/**
 * @param {{ force?: boolean }} [opts]
 * @returns {Promise<ReferenceBundle>}
 */
async function refreshReferenceCache(opts = {}) {
  if (refreshInFlight) return refreshInFlight;

  const genAtStart = cacheGeneration;

  const flight = (async () => {
    try {
      const next = await loadReferenceBundleFresh();
      if (genAtStart !== cacheGeneration) {
        logger.info('referenceCache.refresh.discarded_stale', null, {
          genAtStart,
          currentGeneration: cacheGeneration,
        });
        if (cachedBundle) return cachedBundle;
        return refreshReferenceCache();
      }
      cachedBundle = next;
      return next;
    } catch (err) {
      if (cachedBundle) {
        logger.warn('referenceCache.refresh.failed', null, {
          message: err instanceof Error ? err.message : String(err),
          stale: true,
          staleLoadedAt: new Date(cachedBundle.loadedAt).toISOString(),
        });
        return cachedBundle;
      }
      throw err;
    } finally {
      if (refreshInFlight === flight) {
        refreshInFlight = null;
      }
    }
  })();

  refreshInFlight = flight;
  void opts;
  return flight;
}

/**
 * Прогрев кэша при старте сервера (ошибка без fallback-снимка пробрасывается наверх).
 * @returns {Promise<ReferenceBundle>}
 */
export async function warmupReferenceCache() {
  return refreshReferenceCache();
}

/**
 * Актуальный согласованный снимок справочников (каталог + нормы + appliances).
 * @returns {Promise<ReferenceBundle>}
 */
export async function getReferenceBundle() {
  const ttlMs = resolveTtlMs();
  const now = Date.now();
  if (cachedBundle && now - cachedBundle.loadedAt < ttlMs) {
    return cachedBundle;
  }
  return refreshReferenceCache();
}
