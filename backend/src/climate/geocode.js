/**
 * Назначение: геокодинг адресы через Nominatim.
 * Описание: Преобразует текстовый адрес в координаты lat/lon через OpenStreetMap Nominatim для последующего климатического расчёта. Требует User-Agent (GEOCODE_USER_AGENT). Экспортирует geocodeAddress(); вызывается из climate/index.js.
 */

import { logger } from '../utils/logger.js';
import { throwAppError } from '../utils/createAppError.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DEFAULT_GEOCODE_TIMEOUT_MS = 8_000;

/**
 * Таймаут HTTP до Nominatim: GEOCODE_TIMEOUT_MS або дефолт 8000 мс.
 *
 * @returns {number}
 */
function resolveGeocodeTimeoutMs() {
  const n = Number(process.env.GEOCODE_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_GEOCODE_TIMEOUT_MS;
}

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isAbortError(err) {
  if (!err || typeof err !== 'object') return false;
  const named = /** @type {{ name?: string, code?: string }} */ (err);
  if (named.name === 'AbortError' || named.code === 'ABORT_ERR') return true;
  return err instanceof Error && /aborted|AbortError/i.test(err.message);
}

/**
 * Геокодинг адреси через Nominatim (OpenStreetMap).
 *
 * Повертає координати (lat/lon) для подальших кліматичних розрахунків.
 * Важливо: Nominatim просить вказувати User-Agent (див. GEOCODE_USER_AGENT).
 *
 * @param {string} address
 * @returns {Promise<import('../types/shared-types.js').LocationInput & { displayName?: string | null } | null>}
 */
export async function geocodeAddress(address) {
  if (!address || typeof address !== 'string') return null;

  logger.info('climate.geocode.start', null, { hasAddress: true });

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  const timeoutMs = resolveGeocodeTimeoutMs();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  /** @type {Response} */
  let resp;
  try {
    resp = await fetch(url, {
      headers: {
        // Nominatim просит указывать User-Agent.
        'user-agent': process.env.GEOCODE_USER_AGENT ?? 'heating-selection-service/1.0',
        accept: 'application/json',
      },
      signal: ctrl.signal,
    });
  } catch (err) {
    if (isAbortError(err)) {
      logger.warn('climate.geocode.fail', null, {
        reason: 'timeout',
        timeoutMs,
      });
      throwAppError(
        'Таймаут геокодування адреси (Nominatim)',
        'GEOCODE_TIMEOUT',
        502,
      );
    }
    logger.warn('climate.geocode.fail', null, {
      reason: 'network',
      message: err instanceof Error ? err.message : String(err),
    });
    throwAppError('Не вдалося виконати геокодування адреси', 'GEOCODE_FAILED', 502);
  } finally {
    clearTimeout(t);
  }

  if (!resp.ok) {
    logger.warn('climate.geocode.fail', null, { status: resp.status });
    throwAppError('Не вдалося виконати геокодування адреси', 'GEOCODE_FAILED', 502);
  }

  /** @type {unknown} */
  const data = await resp.json();
  const first = Array.isArray(data) ? data[0] : null;
  if (!first) return null;

  const row = /** @type {{ lat?: unknown, lon?: unknown, display_name?: unknown }} */ (first);

  logger.info('climate.geocode.ok', null, { lat: Number(row.lat), lon: Number(row.lon) });

  return {
    lat: Number(row.lat),
    lon: Number(row.lon),
    displayName: typeof row.display_name === 'string' ? row.display_name : null,
  };
}
