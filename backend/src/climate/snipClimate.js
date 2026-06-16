/**
 * Назначение: климатический расчёт по данным Meteostat.
 * Описание: Загружает bulk-данные станций и суточные температуры с data.meteostat.net, находит ближайшую станцию и минимальное 5-дневное скользящее среднее как расчётную наружную температуру. Экспортирует getDesignOutsideTempFromMeteostat(); вызывается из climate/index.js.
 */

import { gunzipSync } from 'node:zlib';
import { logger } from '../utils/logger.js';

const STATIONS_LITE_GZ_URL = 'https://bulk.meteostat.net/v2/stations/lite.json.gz';
const DAILY_CSV_GZ_URL = (year, stationId) => `https://data.meteostat.net/daily/${year}/${stationId}.csv.gz`;

/** @type {Promise<Array<{ id: string, lat: number, lon: number }>> | null} */
let stationsLiteCachePromise = null;

/**
 * Модуль кліматичного розрахунку на основі **безкоштовних bulk-даних Meteostat** (без RapidAPI).
 *
 * Результат: одна температура (°C), яку ми трактуємо як “температуру найхолоднішої пʼятиденки”.
 * Для MVP це наближення:
 * - беремо щоденні середні температури (tavg)
 * - шукаємо мінімальне ковзне середнє за 5 днів
 */

function toInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function minRollingAverage(values, windowSize) {
  if (!Array.isArray(values) || values.length < windowSize) return null;
  let sum = 0;
  for (let i = 0; i < windowSize; i += 1) sum += values[i];
  let min = sum / windowSize;
  for (let i = windowSize; i < values.length; i += 1) {
    sum += values[i] - values[i - windowSize];
    const avg = sum / windowSize;
    if (avg < min) min = avg;
  }
  return min;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

async function fetchBuffer(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  let resp;
  try {
    resp = await fetch(url, { headers: { accept: '*/*' }, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
  if (!resp.ok) {
    const err = new Error(`Не удалось загрузить Meteostat bulk: ${url} (HTTP ${resp.status})`);
    err.statusCode = 502;
    err.code = 'METEOSTAT_BULK_HTTP_ERROR';
    throw err;
  }
  const ab = await resp.arrayBuffer();
  return Buffer.from(ab);
}

async function headOk(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const resp = await fetch(url, { method: 'HEAD', headers: { accept: '*/*' }, signal: ctrl.signal });
    return resp.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function loadStationsLite() {
  if (!stationsLiteCachePromise) {
    stationsLiteCachePromise = (async () => {
      logger.info('climate.meteostat.stationsLite.start', null);
      const gz = await fetchBuffer(STATIONS_LITE_GZ_URL);
      let jsonText;
      try {
        jsonText = gunzipSync(gz).toString('utf8');
      } catch {
        const err = new Error('Не удалось распаковать stations/lite.json.gz');
        err.statusCode = 502;
        err.code = 'METEOSTAT_STATIONS_LITE_GUNZIP_FAILED';
        throw err;
      }

      /** @type {unknown} */
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        const err = new Error('Некорректный формат stations/lite.json.gz (ожидался массив)');
        err.statusCode = 502;
        err.code = 'METEOSTAT_STATIONS_LITE_BAD_FORMAT';
        throw err;
      }

      const lite = parsed
        .map((s) => {
          const id = s?.id ?? s?.i ?? null;
          const lat = s?.location?.latitude ?? s?.lat ?? s?.latitude ?? null;
          const lon = s?.location?.longitude ?? s?.lon ?? s?.longitude ?? null;
          if (!id) return null;
          if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
          return { id: String(id), lat: Number(lat), lon: Number(lon) };
        })
        .filter(Boolean);

      logger.info('climate.meteostat.stationsLite.ok', null, { count: lite.length });
      return /** @type {Array<{ id: string, lat: number, lon: number }>} */ (lite);
    })();
  }
  return stationsLiteCachePromise;
}

async function pickNearestStationId(lat, lon) {
  const stations = await loadStationsLite();
  let best = null;
  let bestKm = Infinity;
  const bestCandidates = [];
  for (const s of stations) {
    const km = haversineKm(lat, lon, s.lat, s.lon);
    if (km < bestKm) {
      bestKm = km;
      best = s;
    }
    // Держим топ-20 кандидатів поблизу (для випадків, коли найближча станція не має daily).
    if (bestCandidates.length < 20) {
      bestCandidates.push({ id: s.id, km });
      bestCandidates.sort((a, b) => a.km - b.km);
    } else if (km < bestCandidates[bestCandidates.length - 1].km) {
      bestCandidates[bestCandidates.length - 1] = { id: s.id, km };
      bestCandidates.sort((a, b) => a.km - b.km);
    }
  }
  return {
    stationId: best?.id ?? null,
    distanceKm: bestKm,
    candidates: bestCandidates,
  };
}

function parseDailyCsvTavg(csvText) {
  const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(',').map((x) => x.trim());
  // В bulk daily по документации колонка средней температуры может называться `temp`
  // (а в некоторых форматах встречается `tavg`). Поддерживаем оба варианта.
  const idxTemp = header.indexOf('tavg') >= 0 ? header.indexOf('tavg') : header.indexOf('temp');
  if (idxTemp < 0) return [];
  const out = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',');
    const v = cols[idxTemp];
    const n = Number(v);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/**
 * Получить расчётную наружную температуру «самой холодной пятидневки» через Meteostat.
 *
 * Подход MVP:
 * - Берём дневные средние температуры (tavg) за последние N лет
 * - Считаем минимальное скользящее среднее за 5 дней
 *
 * Это приближение к «температуре самой холодной пятидневки» по нормативам.
 */
/**
 * @param {{ lat: number, lon: number }} args
 * @returns {Promise<number>}
 */
export async function getDesignOutsideTempFromMeteostat({ lat, lon }) {
  const years = Math.max(1, Math.min(50, toInt(process.env.METEOSTAT_YEARS, 10)));

  const end = new Date();
  const start = new Date(end);
  start.setFullYear(end.getFullYear() - years);

  logger.info('climate.meteostat.stations.start', null, { lat: Number(lat), lon: Number(lon), years });

  const { candidates } = await pickNearestStationId(Number(lat), Number(lon));
  if (!candidates?.length) {
    logger.warn('climate.meteostat.stations.none', null, { lat: Number(lat), lon: Number(lon) });
    const err = new Error('Не найдена станция Meteostat рядом с указанными координатами');
    err.statusCode = 502;
    err.code = 'METEOSTAT_NO_STATION';
    throw err;
  }

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const windowYears = [];
  for (let y = startYear; y <= endYear; y += 1) windowYears.push(y);

  // Пробуем несколько ближайших станций: часто у самой близкой нет daily-данных.
  for (const c of candidates) {
    const stationId = c.id;
    const allTavg = [];

    // Быстрый “пробник”: если нет daily хотя бы за один из последних 3 лет — станцию пропускаем.
    // Это резко снижает объём скачиваний и делает путь более стабильным.
    const probeYears = [endYear, endYear - 1, endYear - 2].filter((y) => y >= startYear);
    let hasAny = false;
    for (const y of probeYears) {
      // HEAD дешевле, чем скачивать .csv.gz
      // Если год недоступен (404) — идём дальше
      // Если хотя бы один доступен — пробуем станцию полноценно.
      if (await headOk(DAILY_CSV_GZ_URL(y, stationId))) {
        hasAny = true;
        break;
      }
    }
    if (!hasAny) {
      logger.info('climate.meteostat.daily.skipNoRecentData', null, { stationId });
      continue;
    }

    logger.info('climate.meteostat.daily.start', null, {
      stationId,
      distanceKm: Number(c.km.toFixed(1)),
      years: windowYears.length,
    });

    for (const y of windowYears) {
      const url = DAILY_CSV_GZ_URL(y, stationId);
      let gz;
      try {
        gz = await fetchBuffer(url);
      } catch {
        // Если год отсутствует — просто пропускаем; это нормально для многих станций.
        continue;
      }
      let csvText;
      try {
        csvText = gunzipSync(gz).toString('utf8');
      } catch {
        logger.warn('climate.meteostat.daily.gunzipFail', null, { stationId, year: y });
        continue;
      }
      const tavg = parseDailyCsvTavg(csvText);
      for (const t of tavg) allTavg.push(t);
    }

    const min5day = minRollingAverage(allTavg, 5);
    if (min5day == null) {
      logger.warn('climate.meteostat.daily.insufficient', null, { stationId, points: allTavg.length });
      continue;
    }

    const result = Math.round(min5day * 10) / 10;
    logger.info('climate.meteostat.ok', null, { stationId, resultC: result });
    return result;
  }

  const err = new Error('Недостаточно данных Meteostat для расчёта пятидневки');
  err.statusCode = 502;
  err.code = 'METEOSTAT_INSUFFICIENT_DATA';
  throw err;
}

