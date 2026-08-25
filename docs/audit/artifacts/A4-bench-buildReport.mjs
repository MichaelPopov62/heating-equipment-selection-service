/**
 * A4 (аудит производительности) — замер buildReport на объектах разного размера.
 *
 * Запуск (из корня репозитория):
 *   LOG_LEVEL=error node --expose-gc docs/audit/artifacts/A4-bench-buildReport.mjs
 *
 * Вход строится детерминированно (LCG-псевдослучайность с фиксированным сидом)
 * по образцу backend/scripts/fuzz-calc.ts (профиль house_radiators_ufh + mixed UFH).
 * Контекст справочников — backend/scripts/fixtures/calcRuntimeContextFromFiles.js
 * (файлы backend/data + backend/test_data.json.example), без MongoDB.
 *
 * temps.outsideC задан явно → внешние вызовы (Nominatim/Meteostat) НЕ выполняются,
 * измеряется чистый CPU расчёта.
 */
import { performance } from 'node:perf_hooks';
import { loadCalcRuntimeContextFromFiles } from '../../../backend/scripts/fixtures/calcRuntimeContextFromFiles.js';
import { buildReport } from '../../../backend/src/report/public.js';
import { validateAndNormalizeInput } from '../../../backend/src/api/validate.js';

// ---------- детерминированный ГПСЧ ----------
let seed = 20260823;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const randomIn = (min, max, round = 1) => {
  const f = 10 ** round;
  return Math.round((rnd() * (max - min) + min) * f) / f;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const WALL_PRESET_ID = 'wall_gas_concrete_d500';
const WINDOW_PRESET_ID = 'window_pvc_double_chamber_3_glass';
const UFH_BASE_PRESET_ID = 'ufh_base_interstory_screed_65';
const ORIENTATIONS = ['N', 'NE', 'E', 'SE', 'SW', 'NW'];
const FINISH = ['ceramic_tile', 'pvc_glue', 'pvc_click', 'laminate_click'];
const SPACING = [100, 150, 200];
const ROOM_TYPES = ['гостиная', 'кухня', 'спальня', 'санузел', 'прихожая'];

/**
 * Дом с N помещениями: фасадная стена + окно на каждое, ТП примерно в трети комнат.
 * @param {number} roomsCount
 */
function buildInput(roomsCount) {
  seed = 20260823 + roomsCount; // детерминировано и одинаково между прогонами
  const rooms = [];
  const envelopeElements = [];
  for (let i = 1; i <= roomsCount; i += 1) {
    const roomId = `r${i}`;
    const areaM2 = randomIn(10, 30, 1);
    const type = i === 1 ? 'гостиная' : pick(ROOM_TYPES);
    const orientation = pick(ORIENTATIONS);
    const enableUfh = type === 'кухня' || type === 'санузел' || i % 3 === 0;
    rooms.push({
      id: roomId,
      name: `Кімната ${i}`,
      type,
      floor: 1,
      topBoundary: 'heated',
      bottomBoundary: 'unheated',
      areaM2,
      heightM: randomIn(2.6, 3.0, 2),
      roomExteriorLayout: 'facade',
      ...(enableUfh
        ? {
            underfloorHeating: {
              enabled: true,
              basePresetId: UFH_BASE_PRESET_ID,
              finishMaterialId: pick(FINISH),
              pipeSpacingMm: pick(SPACING),
            },
          }
        : {}),
    });
    const w = randomIn(1200, 1800, 0);
    const h = randomIn(1200, 1500, 0);
    envelopeElements.push(
      {
        kind: 'wall',
        roomId,
        construction: 'наружная стена',
        presetId: WALL_PRESET_ID,
        areaM2: randomIn(6, 14, 1),
        orientation,
      },
      {
        kind: 'window',
        roomId,
        construction: 'окно',
        presetId: WINDOW_PRESET_ID,
        areaM2: Math.round(((w * h) / 1_000_000) * 100) / 100,
        orientation,
        openingWidthMm: w,
        openingHeightMm: h,
      },
      {
        kind: 'floor',
        roomId,
        construction: 'пол',
        presetId: 'floor_concrete_uninsulated',
        areaM2,
      },
    );
  }

  return {
    building: {
      temps: { insideC: 20, outsideC: -22 },
      objectMeta: {
        objectType: 'house',
        floors: 1,
        roomsCount,
        ventilationReserveMode: 'natural',
        boilerPlacementZone: 'kitchen',
        externalWalls: {
          presetId: WALL_PRESET_ID,
          thicknessMm: 375,
          facadeSystem: 'none',
        },
      },
      rooms,
      envelopeElements,
    },
    heatingSystem: {
      supplyC: 75,
      returnC: 65,
      insideC: 20,
      thermalRegimePreset: 'traditional_dt50_75_65',
      waterUnderfloorHeating: true,
      ufhPresetId: 'ufh_mixed_radiators',
      hotWaterBoilerPowerMatchingScheme: 'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
    },
    hotWater: {
      residents: 4,
      coldWaterDesignSeason: 'winter',
      hotWaterC: 60,
      tropicalShower: false,
      fixtures: { shower: 2, sink: 2, kitchenSink: 1, bath: 1, toilet: 2 },
    },
    hydraulics: { mainLineLengthM: 12, deltaTSystemK: 20 },
  };
}

const quantile = (sorted, q) => {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
};

async function main() {
  const t0 = performance.now();
  const ctx = await loadCalcRuntimeContextFromFiles();
  const ctxMs = performance.now() - t0;
  console.log(`# loadCalcRuntimeContextFromFiles (холодный, из файлов): ${ctxMs.toFixed(1)} ms`);
  console.log(`# node ${process.version}, ${process.platform}/${process.arch}`);
  console.log('');

  const SIZES = [1, 2, 3, 5, 10, 25, 50];
  const WARMUP = 5;
  const ITER = 25;

  console.log('| помещений | итераций | min мс | медиана мс | p95 мс | max мс | heapUsed дельта/итер, МБ | RSS после, МБ | JSON отчёта, КБ |');
  console.log('|---|---|---|---|---|---|---|---|---|');

  const rows = [];
  for (const n of SIZES) {
    const raw = buildInput(n);
    const input = validateAndNormalizeInput(raw, ctx);

    for (let i = 0; i < WARMUP; i += 1) await buildReport({ input, ctx });

    if (global.gc) global.gc();
    const heapBefore = process.memoryUsage().heapUsed;
    const times = [];
    let lastReport = null;
    for (let i = 0; i < ITER; i += 1) {
      const s = performance.now();
      lastReport = await buildReport({ input, ctx });
      times.push(performance.now() - s);
    }
    const heapAfter = process.memoryUsage().heapUsed;
    const rss = process.memoryUsage().rss;

    const sorted = [...times].sort((a, b) => a - b);
    const median = quantile(sorted, 0.5);
    const p95 = quantile(sorted, 0.95);
    const jsonKb = Buffer.byteLength(JSON.stringify(lastReport), 'utf8') / 1024;
    const heapPerIterMb = (heapAfter - heapBefore) / ITER / 1024 / 1024;

    rows.push({ n, median, p95, jsonKb });
    console.log(
      `| ${n} | ${ITER} | ${sorted[0].toFixed(2)} | ${median.toFixed(2)} | ${p95.toFixed(2)} | `
      + `${sorted[sorted.length - 1].toFixed(2)} | ${heapPerIterMb.toFixed(2)} | `
      + `${(rss / 1024 / 1024).toFixed(0)} | ${jsonKb.toFixed(1)} |`,
    );
  }

  console.log('');
  console.log('# масштабирование (медиана мс на помещение):');
  for (const r of rows) console.log(`#   ${r.n} комн → ${(r.median / r.n).toFixed(3)} мс/комн`);
}

main().catch((e) => {
  console.error('BENCH FAILED:', e);
  process.exit(1);
});
