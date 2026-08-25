/**
 * A4 — реальный вклад Nominatim + Meteostat в время ответа POST /api/v1/calc.
 * Вызывает ровно тот код, что и buildReport (backend/src/climate/index.js).
 * Запуск: LOG_LEVEL=info node docs/audit/artifacts/A4-bench-climate.mjs
 */
import { performance } from 'node:perf_hooks';
import { geocodeAddress } from '../../../backend/src/climate/geocode.js';
import { getDesignOutsideTempFromMeteostat } from '../../../backend/src/climate/snipClimate.js';
import { getDesignOutsideTempC } from '../../../backend/src/climate/index.js';

console.log(`# METEOSTAT_YEARS = ${process.env.METEOSTAT_YEARS ?? '(дефолт 10)'}`);

// 1) Nominatim
const t1 = performance.now();
const geo = await geocodeAddress('Київ, вулиця Хрещатик 1');
const geoMs = performance.now() - t1;
console.log(`\n## Nominatim (геокодинг)`);
console.log(`| адрес | мс | результат |`);
console.log(`|---|---|---|`);
console.log(`| Київ, Хрещатик 1 | ${geoMs.toFixed(0)} | lat=${geo?.lat} lon=${geo?.lon} |`);

// 2) Meteostat: первый вызов (качает stations lite.json.gz) + второй (кэш станций в процессе)
console.log(`\n## Meteostat (bulk)`);
console.log(`| вызов | мс | результат °C |`);
console.log(`|---|---|---|`);
const t2 = performance.now();
const c1 = await getDesignOutsideTempFromMeteostat({ lat: Number(geo.lat), lon: Number(geo.lon) });
console.log(`| 1-й (включая скачивание stations/lite.json.gz) | ${(performance.now() - t2).toFixed(0)} | ${c1} |`);

const t3 = performance.now();
const c2 = await getDesignOutsideTempFromMeteostat({ lat: Number(geo.lat), lon: Number(geo.lon) });
console.log(`| 2-й, те же координаты (список станций уже в памяти процесса) | ${(performance.now() - t3).toFixed(0)} | ${c2} |`);

const t4 = performance.now();
const c3 = await getDesignOutsideTempFromMeteostat({ lat: 49.8397, lon: 24.0297 }); // Львів
console.log(`| 3-й, ДРУГОЙ город (Львів) | ${(performance.now() - t4).toFixed(0)} | ${c3} |`);

// 3) Полная цепочка как в buildReport
const t5 = performance.now();
const full = await getDesignOutsideTempC({ address: 'Одеса, Дерибасівська 1' });
console.log(`\n## Полная цепочка getDesignOutsideTempC({ address }) — как внутри buildReport`);
console.log(`| адрес | мс | °C |`);
console.log(`|---|---|---|`);
console.log(`| Одеса, Дерибасівська 1 | ${(performance.now() - t5).toFixed(0)} | ${full?.designOutsideTempC} |`);

// 4) Размер bulk-файлов
console.log(`\n## Объём скачиваемого`);
const head = async (u) => { const r = await fetch(u, { method: 'HEAD' }); return r.headers.get('content-length'); };
const st = await head('https://bulk.meteostat.net/v2/stations/lite.json.gz');
console.log(`| stations/lite.json.gz | ${(Number(st)/1048576).toFixed(1)} МБ |`);
console.log(`|---|---|`);
const y = new Date().getFullYear();
let sum = 0;
for (const yy of [y, y-1, y-2]) {
  try { const s = await head(`https://data.meteostat.net/daily/${yy}/33345.csv.gz`); if (s) { sum += Number(s); console.log(`| daily/${yy}/33345.csv.gz | ${(Number(s)/1024).toFixed(0)} КБ |`); } }
  catch { console.log(`| daily/${yy}/33345.csv.gz | недоступен |`); }
}
