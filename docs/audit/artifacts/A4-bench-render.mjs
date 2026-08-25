/**
 * A4 — тот же вход на боевом инстансе Render free.
 * Запуск: node docs/audit/artifacts/A4-bench-render.mjs
 * ВНИМАНИЕ: POST /api/v1/calc в проде лимитирован 20 запросами / 15 мин на IP.
 */
const BASE = 'https://heatcalc-api-mp62.onrender.com';
const WALL = 'wall_gas_concrete_d500';
const WIN = 'window_pvc_double_chamber_3_glass';
const UFH_BASE = 'ufh_base_interstory_screed_65';

function buildInput(roomsCount, { ufhShare = 1 / 3 } = {}) {
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
      objectMeta: { objectType: 'house', floors: 1, roomsCount: Math.min(roomsCount, 50),
        ventilationReserveMode: 'natural', boilerPlacementZone: 'kitchen',
        externalWalls: { presetId: WALL, thicknessMm: 375, facadeSystem: 'none' } },
      rooms, envelopeElements },
    heatingSystem: { supplyC: 75, returnC: 65, insideC: 20, thermalRegimePreset: 'traditional_dt50_75_65',
      ...(anyUfh ? { waterUnderfloorHeating: true, ufhPresetId: 'ufh_mixed_radiators' } : {}),
      hotWaterBoilerPowerMatchingScheme: 'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw' },
    hotWater: { residents: 4, coldWaterDesignSeason: 'winter', hotWaterC: 60, tropicalShower: false,
      fixtures: { shower: 2, sink: 2, kitchenSink: 1, bath: 1, toilet: 2 } },
    hydraulics: { mainLineLengthM: 12, deltaTSystemK: 20 } };
}

async function post(payload) {
  const body = JSON.stringify(payload);
  const t0 = performance.now();
  const r = await fetch(`${BASE}/api/v1/calc`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body,
  });
  const text = await r.text();
  const ms = performance.now() - t0;
  return { ms, status: r.status, reqKb: Buffer.byteLength(body) / 1024,
    respKb: Buffer.byteLength(text) / 1024,
    remaining: r.headers.get('ratelimit-remaining'),
    code: (() => { try { return JSON.parse(text)?.error?.code ?? ''; } catch { return ''; } })() };
}

const cases = process.argv.slice(2).length
  ? process.argv.slice(2).map((s) => { const [n, share] = s.split(':'); return [Number(n), Number(share ?? 1 / 3)]; })
  : [[1, 0], [10, 1 / 3], [50, 1 / 3], [50, 1]];

console.log('| комнат | ufhShare | запрос КБ | HTTP | ответ КБ | end-to-end мс | ratelimit-remaining |');
console.log('|---|---|---|---|---|---|---|');
for (const [n, share] of cases) {
  const r = await post(buildInput(n, { ufhShare: share }));
  console.log(`| ${n} | ${share.toFixed(2)} | ${r.reqKb.toFixed(0)} | ${r.status}${r.code ? ' ' + r.code : ''} | ${r.respKb.toFixed(0)} | ${r.ms.toFixed(0)} | ${r.remaining ?? '—'} |`);
  await new Promise((res) => setTimeout(res, 1500));
}
