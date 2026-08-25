/**
 * A4 — уточнение: (а) чистый замер блокировки event loop, (б) худший вход, влезающий в express.json limit 1mb.
 * Запуск: LOG_LEVEL=error node docs/audit/artifacts/A4-bench-worstcase.mjs
 */
import { performance } from 'node:perf_hooks';
import { loadCalcRuntimeContextFromFiles } from '../../../backend/scripts/fixtures/calcRuntimeContextFromFiles.js';
import { buildReport } from '../../../backend/src/report/public.js';
import { validateAndNormalizeInput } from '../../../backend/src/api/validate.js';

const WALL = 'wall_gas_concrete_d500';
const WIN = 'window_pvc_double_chamber_3_glass';
const UFH_BASE = 'ufh_base_interstory_screed_65';

function buildInput(roomsCount, { ufhShare = 1 / 3, declaredRoomsCount } = {}) {
  const declared = declaredRoomsCount ?? roomsCount;
  const rooms = []; const envelopeElements = [];
  for (let i = 1; i <= roomsCount; i += 1) {
    const roomId = `r${i}`;
    const areaM2 = 12 + (i % 17);
    const enableUfh = ufhShare > 0 && i % Math.max(1, Math.round(1 / ufhShare)) === 0;
    rooms.push({ id: roomId, name: `K${i}`, type: 'гостиная', floor: 1, topBoundary: 'heated',
      bottomBoundary: 'unheated', areaM2, heightM: 2.7, roomExteriorLayout: 'facade',
      ...(enableUfh ? { underfloorHeating: { enabled: true, basePresetId: UFH_BASE,
        finishMaterialId: 'ceramic_tile', pipeSpacingMm: 150 } } : {}) });
    envelopeElements.push(
      { kind: 'wall', roomId, construction: 'наружная стена', presetId: WALL, areaM2: 10, orientation: 'N' },
      { kind: 'window', roomId, construction: 'окно', presetId: WIN, areaM2: 2.1, orientation: 'N',
        openingWidthMm: 1400, openingHeightMm: 1500 },
      { kind: 'floor', roomId, construction: 'пол', presetId: 'floor_concrete_uninsulated', areaM2 });
  }
  const anyUfh = rooms.some((r) => r.underfloorHeating);
  return { building: { temps: { insideC: 20, outsideC: -22 },
      objectMeta: { objectType: 'house', floors: 1, roomsCount: declared, ventilationReserveMode: 'natural',
        boilerPlacementZone: 'kitchen', externalWalls: { presetId: WALL, thicknessMm: 375, facadeSystem: 'none' } },
      rooms, envelopeElements },
    heatingSystem: { supplyC: 75, returnC: 65, insideC: 20, thermalRegimePreset: 'traditional_dt50_75_65',
      ...(anyUfh ? { waterUnderfloorHeating: true, ufhPresetId: 'ufh_mixed_radiators' } : {}),
      hotWaterBoilerPowerMatchingScheme: 'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw' },
    hotWater: { residents: 4, coldWaterDesignSeason: 'winter', hotWaterC: 60, tropicalShower: false,
      fixtures: { shower: 2, sink: 2, kitchenSink: 1, bath: 1, toilet: 2 } },
    hydraulics: { mainLineLengthM: 12, deltaTSystemK: 20 } };
}

/** Возвращает {total, ticks, longestGap} — насколько долго 1-мс таймер не получал управления. */
async function blockProfile(fn) {
  const marks = [];
  const timer = setInterval(() => marks.push(performance.now()), 1);
  await new Promise((r) => setTimeout(r, 20)); // дать таймеру раскрутиться
  const t0 = performance.now();
  await fn();
  const t1 = performance.now();
  await new Promise((r) => setTimeout(r, 20));
  clearInterval(timer);
  const during = marks.filter((m) => m >= t0 && m <= t1);
  const before = marks.filter((m) => m < t0).pop() ?? t0;
  const after = marks.find((m) => m > t1) ?? t1;
  const gaps = [before, ...during, after];
  let longest = 0;
  for (let i = 1; i < gaps.length; i += 1) longest = Math.max(longest, gaps[i] - gaps[i - 1]);
  return { total: t1 - t0, ticks: during.length, longest };
}

async function main() {
  const ctx = await loadCalcRuntimeContextFromFiles();
  console.log(`# node ${process.version} ${process.platform}/${process.arch}\n`);

  console.log('## Блокировка event loop (1-мс таймер во время buildReport)');
  console.log('| комнат | ufhShare | buildReport мс | тиков 1-мс таймера за это время | макс. непрерывный интервал без тика, мс |');
  console.log('|---|---|---|---|---|');
  for (const [n, share] of [[10, 1/3], [50, 1/3], [50, 1]]) {
    const input = validateAndNormalizeInput(buildInput(n, { ufhShare: share }), ctx);
    for (let i = 0; i < 3; i += 1) await buildReport({ input, ctx });
    const r = await blockProfile(() => buildReport({ input, ctx }));
    console.log(`| ${n} | ${share.toFixed(2)} | ${r.total.toFixed(1)} | ${r.ticks} | ${r.longest.toFixed(1)} |`);
  }
  console.log('');

  console.log('## Худший вход, влезающий в express.json({ limit: "1mb" })');
  console.log('| комнат в rooms[] | тело JSON, КБ | AJV | buildReport мс | JSON отчёта, КБ |');
  console.log('|---|---|---|---|---|');
  for (const n of [1000, 1500, 1600]) {
    const raw = buildInput(n, { declaredRoomsCount: 50, ufhShare: 1 / 3 });
    const bodyKb = Buffer.byteLength(JSON.stringify(raw), 'utf8') / 1024;
    if (bodyKb > 1024) { console.log(`| ${n} | ${bodyKb.toFixed(0)} | тело > 1 МБ, express отвергнет (413) | — | — |`); continue; }
    try {
      const input = validateAndNormalizeInput(raw, ctx);
      const s = performance.now();
      const rep = await buildReport({ input, ctx });
      const ms = performance.now() - s;
      const outKb = Buffer.byteLength(JSON.stringify(rep), 'utf8') / 1024;
      console.log(`| ${n} | ${bodyKb.toFixed(0)} | ДА | ${ms.toFixed(0)} | ${outKb.toFixed(0)} |`);
    } catch (e) { console.log(`| ${n} | ${bodyKb.toFixed(0)} | НЕТ (${e.code ?? e.message}) | — | — |`); }
  }
}
main().catch((e) => { console.error('FAILED:', e); process.exit(1); });
