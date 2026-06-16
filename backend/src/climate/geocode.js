/**
 * Назначение: геокодинг адресы через Nominatim.
 * Описание: Преобразует текстовый адрес в координаты lat/lon через OpenStreetMap Nominatim для последующего климатического расчёта. Требует User-Agent (GEOCODE_USER_AGENT). Экспортирует geocodeAddress(); вызывается из climate/index.js.
 */

import { logger } from '../utils/logger.js';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Геокодинг адреси через Nominatim (OpenStreetMap).
 *
 * Повертає координати (lat/lon) для подальших кліматичних розрахунків.
 * Важливо: Nominatim просить вказувати User-Agent (див. GEOCODE_USER_AGENT).
 */
/**
 * @param {string} address
 * @returns {Promise<import('../types/shared-types').LocationInput & { displayName?: string | null } | null>}
 */
export async function geocodeAddress(address) {
  if (!address || typeof address !== 'string') return null;

  logger.info('climate.geocode.start', null, { hasAddress: true });

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', address);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  const resp = await fetch(url, {
    headers: {
      // Nominatim просит указывать User-Agent.
      'user-agent': process.env.GEOCODE_USER_AGENT ?? 'heating-selection-service/1.0',
      accept: 'application/json',
    },
  });

  if (!resp.ok) {
    logger.warn('climate.geocode.fail', null, { status: resp.status });
    const err = new Error('Не удалось выполнить геокодинг адреса');
    err.statusCode = 502;
    err.code = 'GEOCODE_FAILED';
    throw err;
  }

  /** @type {unknown} */
  const data = await resp.json();
  const first = Array.isArray(data) ? data[0] : null;
  if (!first) return null;

  logger.info('climate.geocode.ok', null, { lat: Number(first.lat), lon: Number(first.lon) });

  return {
    lat: Number(first.lat),
    lon: Number(first.lon),
    displayName: first.display_name ?? null,
  };
}
