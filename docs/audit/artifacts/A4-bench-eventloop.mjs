/**
 * A4 — что делает buildReport с event loop и во что обходится «злой» вход.
 *
 * Запуск (из корня репозитория):
 *   LOG_LEVEL=error node docs/audit/artifacts/A4-bench-eventloop.mjs
 *
 * Три опыта:
 *  1) вклад тёплого пола (UFH): 50 комнат с ТП и без ТП;
 *  2) блокировка event loop — самый длинный непрерывный «затык» таймера во время одного buildReport;
 *  3) «злой» вход: rooms.length НЕ ограничен схемой (ограничен только objectMeta.roomsCount ≤ 50
 *     и express.json({ limit: '1mb' })) — сколько комнат влезает в 1 МБ и сколько это стоит CPU.
 */
import { performance } from 'node:perf_hooks';
import { loadCalcRuntimeContextFromFiles } from '../../../backend/scripts/fixtures/calcRuntimeContextFromFiles.js';
import { buildReport } from '../../../backend/src/report/public.js';
import { validateAndNormalizeInput } from '../../../backend/src/api/validate.js';

const WALL = 'wall_gas_concrete_d500';
const WIN = 'window_pvc_double_chamber_3_glass';
const UFH_BASE = 'ufh_base_interstory_screed_65';

/**
 * @param {number} roomsCount — сколько комнат положить в rooms[]
 * @param {{ ufhShare?: number, declaredRoomsCount?: number }} [opts]
 *        ufhShare — доля комнат с тёплым полом (0..1); declaredRoomsCount — что написать в objectMeta.
 */
function buildInput(roomsCount, opts = {}) {
  const ufhShare = opts.ufhShare ?? 1 / 3;
  const declared = opts.declaredRoomsCount ?? roomsCount;
  const rooms = [];
  const envelopeElements = [];
  for (let i = 1; i <= roomsCount; i += 1) {
    const roomId = `r${i}`;
    const areaM2 = 12 + (i % 17);
    const enableUfh = ufhShare > 0 && i % Math.max(1, Math.round(1 / ufhShare)) === 0;
    rooms.push({
      id: roomId,
      name: `K${i}`,
      type: 'гостиная',
      floor: 1,
      topBoundary: 'heated',
      bottomBoundary: 'unheated',
      areaM2,
      heightM: 2.7,
      roomExteriorLayout: 'facade',
      ...(enableUfh
        ? {
            underfloorHeating: {
              enabled: true,
              basePresetId: UFH_BASE,
              finishMaterialId: 'ceramic_tile',
              pipeSpacingMm: 150,
            },
          }
        : {}),
    });
    envelopeElements.push(
      { kind: 'wall', roomId, construction: 'наружная стена', presetId: WALL, areaM2: 10, orientation: 'N' },
      {
        kind: 'window', roomId, construction: 'окно', presetId: WIN, areaM2: 2.1,
        orientation: 'N', openingWidthMm: 1400, openingHeightMm: 1500,
      },
      { kind: 'floor', roomId, construction: 'пол', presetId: 'floor_concrete_uninsulated', areaM2 },
    );
  }
  const anyUfh = rooms.some((r) => r.underfloorHeating);
  return {
    building: {
      temps: { insideC: 20, outsideC: -22 },
      objectMeta: {
        objectType: 'house', floors: 1, roomsCount: declared,
        ventilationReserveMode: 'natural', boilerPlacementZone: 'kitchen',
        externalWalls: { presetId: WALL, thicknessMm: 375, facadeSystem: 'none' },
      },
      rooms,
      envelopeElements,
    },
    heatingSystem: {
      supplyC: 75, returnC: 65, insideC: 20,
      thermalRegimePreset: 'traditional_dt50_75_65',
      ...(anyUfh ? { waterUnderfloorHeating: true, ufhPresetId: 'ufh_mixed_radiators' } : {}),
      hotWaterBoilerPowerMatchingScheme: 'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
    },
    hotWater: {
      residents: 4, coldWaterDesignSeason: 'winter', hotWaterC: 60, tropicalShower: false,
      fixtures: { shower: 2, sink: 2, kitchenSink: 1, bath: 1, toilet: 2 },
    },
    hydraulics: { mainLineLengthM: 12, deltaTSystemK: 20 },
  };
}

const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function timeIt(input, ctx, iter = 15) {
  for (let i = 0; i < 3; i += 1) await buildReport({ input, ctx });
  const ts = [];
  for (let i = 0; i < iter; i += 1) {
    const s = performance.now();
    await buildReport({ input, ctx });
    ts.push(performance.now() - s);
  }
  return med(ts);
}

/** Максимальный непрерывный «затык» таймера (мс) за время работы fn. */
async function measureEventLoopBlock(fn) {
  let maxGap = 0;
  let last = performance.now();
  let ticks = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    const gap = now - last - 1;
    if (gap > maxGap) maxGap = gap;
    last = now;
    ticks += 1;
  }, 1);
  const t0 = performance.now();
  const res = await fn();
  const total = performance.now() - t0;
  clearInterval(timer);
  return { maxGap, total, ticks, res };
}

async function main() {
  const ctx = await loadCalcRuntimeContextFromFiles();
  console.log(`# node ${process.version} ${process.platform}/${process.arch}`);
  console.log('');

  // --- 1) вклад тёплого пола ---
  console.log('## 1. Вклад тёплого пола (UFH), 50 комнат');
  console.log('| профиль | комнат с ТП | медиана мс |');
  console.log('|---|---|---|');
  for (const share of [0, 1 / 3, 1]) {
    const raw = buildInput(50, { ufhShare: share });
    const input = validateAndNormalizeInput(raw, ctx);
    const withUfh = raw.building.rooms.filter((r) => r.underfloorHeating).length;
    const m = await timeIt(input, ctx);
    console.log(`| ufhShare=${share.toFixed(2)} | ${withUfh} | ${m.toFixed(2)} |`);
  }
  console.log('');

  // --- 2) блокировка event loop ---
  console.log('## 2. Блокировка event loop одним buildReport');
  console.log('| комнат | общее время мс | макс. непрерывный затык таймера мс | тиков таймера 1 мс за время расчёта |');
  console.log('|---|---|---|---|');
  for (const n of [10, 25, 50]) {
    const raw = buildInput(n);
    const input = validateAndNormalizeInput(raw, ctx);
    for (let i = 0; i < 3; i += 1) await buildReport({ input, ctx });
    const r = await measureEventLoopBlock(() => buildReport({ input, ctx }));
    console.log(`| ${n} | ${r.total.toFixed(1)} | ${r.maxGap.toFixed(1)} | ${r.ticks} |`);
  }
  console.log('');

  // --- 3) «злой» вход: rooms без maxItems ---
  console.log('## 3. rooms[] без maxItems при objectMeta.roomsCount = 50');
  console.log('| комнат в rooms[] | размер тела JSON, КБ | прошёл AJV | медиана buildReport мс |');
  console.log('|---|---|---|---|');
  for (const n of [50, 200, 500, 1000]) {
    const raw = buildInput(n, { declaredRoomsCount: 50, ufhShare: 1 / 3 });
    const bodyKb = Buffer.byteLength(JSON.stringify(raw), 'utf8') / 1024;
    let ok = true;
    let m = NaN;
    try {
      const input = validateAndNormalizeInput(raw, ctx);
      const s = performance.now();
      await buildReport({ input, ctx });
      m = performance.now() - s;
    } catch (e) {
      ok = false;
      m = NaN;
      console.log(`| ${n} | ${bodyKb.toFixed(0)} | НЕТ: ${e.code ?? e.message} | — |`);
      continue;
    }
    console.log(`| ${n} | ${bodyKb.toFixed(0)} | ${ok ? 'ДА' : 'нет'} | ${m.toFixed(0)} |`);
  }
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
