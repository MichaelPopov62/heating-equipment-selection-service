/**
 * Назначение: фасад климатического модуля.
 * Описание: Единая точка получения расчётной наружной температуры: при необходимости геокодирует адрес через geocode.js, затем запрашивает Meteostat через snipClimate.js. Экспортирует getDesignOutsideTempC(); используется в report/buildReport.js при отсутствии temps.outsideC.
 */

import { geocodeAddress } from './geocode.js';
import { getDesignOutsideTempFromMeteostat } from './snipClimate.js';

/**
 * @param {import('../types/shared-types.js').LocationInput} location
 * @returns {Promise<import('../types/shared-types.js').ClimateSnapshot | null>}
 */
export async function getDesignOutsideTempC(location) {
  if (!location || typeof location !== 'object') return null;

  let lat = location.lat;
  let lon = location.lon;
  let geocoded = null;

  if ((!lat || !lon) && location.address) {
    geocoded = await geocodeAddress(location.address);
    lat = geocoded?.lat;
    lon = geocoded?.lon;
  }

  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;

  const designOutsideTempC = await getDesignOutsideTempFromMeteostat({
    lat: Number(lat),
    lon: Number(lon),
  });

  return {
    source: 'meteostat',
    designOutsideTempC,
    lat: Number(lat),
    lon: Number(lon),
    displayName: geocoded?.displayName ?? null,
  };
}

