/**
 * Назначение: verify подбора унибоксов (строгие неравенства, T воздуха, гейты) без HTTP.
 * Запуск: npm run verify:unibox-matching
 */
import assert from 'node:assert/strict';
import { validateAndNormalizeCatalog } from '../src/catalog/validateCatalog.js';
import {
  UNIBOX_DESIGN_PRESSURE_BAR,
  UNIBOX_REQUIRED_FIT,
  UNIBOX_ROOM_AIR_TEMP_PRESETS_C,
  UNIBOX_VALVE_MAX_DP_BAR,
  collectUniboxLoopDemands,
  hasUnderfloorManifoldCascade,
  minKvM3hForFlowLph,
  pickUniboxForDemand,
  pickUniboxes,
  resolveUniboxRoomAirTempC,
  uniboxFitsDemand,
  validateUniboxLoopDemand,
} from '../src/matching/unibox.js';
import { assertAt, assertDefined } from './fixtures/scriptAssert.js';
import {
  buildPartialCatalog,
  buildUfhReport,
  buildUfhRoom,
} from './fixtures/verifyFixtures.js';

/**
 * @param {number} index
 * @returns {import('../src/catalog/types.js').UniboxCatalogItemNormalized}
 */
function uniboxAt(index) {
  return assertAt(UNIBOXES, index, `UNIBOXES[${index}]`);
}

/**
 * Мінімальний envelope каталогу лише з uniboxes (як у runtime після loadCatalog).
 *
 * @param {Record<string, unknown>[]} uniboxes
 * @returns {Record<string, unknown>}
 */
function catalogEnvelopeWithUniboxes(uniboxes) {
  return {
    schemaVersion: 1,
    products: {
      boilers: { doubleCircuit: [], singleCircuit: [] },
      radiators: [],
      waterHeaters: [],
      pipes: [],
    },
    uniboxes,
  };
}

/** @type {import('../src/catalog/types.js').UniboxCatalogItemNormalized[]} */
const UNIBOXES = [
  {
    id: 'UB-RTL-AIR',
    brand: 'Test',
    model: 'RTL+Air',
    type: 'rtl_air',
    loopsCount: 1,
    maxAreaSqM: 20,
    maxLoopLengthM: 80,
    minAirTempC: 6,
    maxAirTempC: 28,
    minCoolantTempC: 10,
    maxCoolantTempC: 50,
    maxTemperatureC: 90,
    maxPressureBar: 10,
    kvM3h: 1.1,
    connection: { thread: 'G3/4', fit: 'eurocone' },
    material: 'Латунь',
    price: 3000,
  },
  {
    id: 'UB-AFC',
    brand: 'Test',
    model: 'AFC',
    type: 'rtl_afc',
    loopsCount: 1,
    maxAreaSqM: 20,
    maxLoopLengthM: 90,
    minCoolantTempC: 0,
    maxCoolantTempC: 50,
    minFlowLph: 30,
    maxFlowLph: 200,
    maxTemperatureC: 90,
    maxPressureBar: 10,
    kvM3h: 1.1,
    connection: { thread: 'G3/4', fit: 'eurocone' },
    material: 'Бронза',
    price: 9000,
  },
  {
    id: 'UB-AIR-ONLY',
    brand: 'Test',
    model: 'AirOnly',
    type: 'air_only',
    loopsCount: 1,
    maxAreaSqM: 20,
    maxLoopLengthM: 100,
    minAirTempC: 6,
    maxAirTempC: 28,
    maxSupplyTempC: 45,
    maxTemperatureC: 90,
    maxPressureBar: 10,
    kvM3h: 1.0,
    connection: { thread: 'G3/4', fit: 'eurocone' },
    material: 'Латунь',
    price: 1500,
  },
  {
    id: 'UB-INTERNAL',
    brand: 'Test',
    model: 'InternalThread',
    type: 'rtl_air',
    loopsCount: 1,
    maxAreaSqM: 20,
    maxLoopLengthM: 80,
    minAirTempC: 6,
    maxAirTempC: 28,
    minCoolantTempC: 10,
    maxCoolantTempC: 50,
    maxTemperatureC: 90,
    maxPressureBar: 10,
    kvM3h: 1.05,
    connection: { thread: 'G1/2', fit: 'internal_thread' },
    material: 'Латунь',
    price: 2000,
  },
  {
    id: 'UB-LOW-AIR',
    brand: 'Test',
    model: 'LowAirMax',
    type: 'rtl_air',
    loopsCount: 1,
    maxAreaSqM: 20,
    maxLoopLengthM: 80,
    minAirTempC: 6,
    maxAirTempC: 22,
    minCoolantTempC: 10,
    maxCoolantTempC: 50,
    maxTemperatureC: 90,
    maxPressureBar: 10,
    kvM3h: 1.1,
    connection: { thread: 'G3/4', fit: 'eurocone' },
    material: 'Латунь',
    price: 3500,
  },
];

const demandOk = {
  areaSqM: 12,
  loopLengthM: 70,
  circuitSupplyC: 40,
  circuitReturnC: 30,
  flowLph: 80,
  roomAirTempC: 20,
  systemPressureBar: UNIBOX_DESIGN_PRESSURE_BAR,
  minKvM3h: minKvM3hForFlowLph(80),
  requiredFit: UNIBOX_REQUIRED_FIT,
};

// Kv: нульовий витрата / захист Δp=0 (fallback/floor, не Infinity)
assert.equal(minKvM3hForFlowLph(0), 0);
assert.ok(Number.isFinite(minKvM3hForFlowLph(80, 0)));
assert.equal(minKvM3hForFlowLph(80, 0), minKvM3hForFlowLph(80));
assert.ok(Number.isFinite(minKvM3hForFlowLph(80, Number.NaN)));
assert.equal(
  minKvM3hForFlowLph(80, 0.001),
  0.08 / Math.sqrt(0.01),
);
assert.equal(UNIBOX_VALVE_MAX_DP_BAR, 0.25);

assert.equal(uniboxFitsDemand(uniboxAt(0), demandOk), true);
assert.equal(uniboxFitsDemand(uniboxAt(2), { ...demandOk, circuitSupplyC: 50 }), false);
assert.equal(
  uniboxFitsDemand(uniboxAt(1), {
    ...demandOk,
    flowLph: 250,
    minKvM3h: minKvM3hForFlowLph(250),
  }),
  false,
);
assert.equal(uniboxFitsDemand(uniboxAt(0), { ...demandOk, roomAirTempC: 35 }), false);
assert.equal(uniboxFitsDemand(uniboxAt(0), { ...demandOk, systemPressureBar: 16 }), false);
assert.equal(uniboxFitsDemand(uniboxAt(3), demandOk), false); // fit !== eurocone
assert.equal(uniboxFitsDemand(uniboxAt(0), { ...demandOk, loopLengthM: 0 }), false);

// Строгие границы паспорта (равенство → reject)
assert.equal(uniboxFitsDemand(uniboxAt(0), { ...demandOk, areaSqM: 20 }), false);
assert.equal(uniboxFitsDemand(uniboxAt(0), { ...demandOk, loopLengthM: 80 }), false);
assert.equal(uniboxFitsDemand(uniboxAt(0), { ...demandOk, circuitSupplyC: 90 }), false);
assert.equal(uniboxFitsDemand(uniboxAt(0), { ...demandOk, systemPressureBar: 10 }), false);
assert.equal(uniboxFitsDemand(uniboxAt(0), { ...demandOk, minKvM3h: 1.1 }), false);
assert.equal(uniboxFitsDemand(uniboxAt(0), { ...demandOk, roomAirTempC: 28 }), false);
assert.equal(uniboxFitsDemand(uniboxAt(0), { ...demandOk, roomAirTempC: 6 }), false);
assert.equal(uniboxFitsDemand(uniboxAt(0), { ...demandOk, circuitReturnC: 50 }), false);
assert.equal(uniboxFitsDemand(uniboxAt(0), { ...demandOk, circuitReturnC: 10 }), false);
assert.equal(uniboxFitsDemand(uniboxAt(1), { ...demandOk, flowLph: 200 }), false);
assert.equal(uniboxFitsDemand(uniboxAt(1), { ...demandOk, flowLph: 30 }), false);
assert.equal(uniboxFitsDemand(uniboxAt(2), { ...demandOk, circuitSupplyC: 45 }), false);

const picked = pickUniboxForDemand(UNIBOXES.slice(0, 4), demandOk);
assert.ok(picked);
assert.equal(picked.id, 'UB-RTL-AIR');

// --- resolve T воздуха ---
assert.equal(UNIBOX_ROOM_AIR_TEMP_PRESETS_C.санузел, 24);
const airBath = resolveUniboxRoomAirTempC('санузел', 20);
assert.ok(airBath);
assert.equal(airBath.roomAirTempC, 24);
assert.equal(airBath.roomAirTempSource, 'preset');
const airBathHigh = resolveUniboxRoomAirTempC('санузел', 26);
assert.ok(airBathHigh);
assert.equal(airBathHigh.roomAirTempC, 26);
assert.equal(airBathHigh.roomAirTempSource, 'survey');
const airBathField = resolveUniboxRoomAirTempC('санузел', 20, 27);
assert.ok(airBathField);
assert.equal(airBathField.roomAirTempC, 27);
assert.equal(airBathField.roomAirTempSource, 'bathroom_field');
const airCorridor = resolveUniboxRoomAirTempC('коридор', 20);
assert.ok(airCorridor);
assert.equal(airCorridor.roomAirTempC, 20);
assert.equal(airCorridor.roomAirTempSource, 'survey');
const airHall = resolveUniboxRoomAirTempC('прихожая', 20);
assert.ok(airHall);
assert.equal(airHall.roomAirTempC, 20);
assert.equal(airHall.roomAirTempSource, 'survey');
const airTambour = resolveUniboxRoomAirTempC('тамбур', 20);
assert.ok(airTambour);
assert.equal(airTambour.roomAirTempC, 20);
assert.equal(airTambour.roomAirTempSource, 'survey');
const airLiving = resolveUniboxRoomAirTempC('гостиная', 20);
assert.ok(airLiving);
assert.equal(airLiving.roomAirTempC, 20);
assert.equal(airLiving.roomAirTempSource, 'survey');
assert.equal(resolveUniboxRoomAirTempC('санузел', Number.NaN), null);

// --- validate demand ---
assert.equal(validateUniboxLoopDemand(demandOk).ok, true);
const badDt = validateUniboxLoopDemand({
  ...demandOk,
  circuitReturnC: 40,
  circuitSupplyC: 40,
});
assert.equal(badDt.ok, false);
if (!badDt.ok) assert.equal(badDt.code, 'UNIBOX_DT');

const defaultUfhLoops = [
  {
    loopId: 'r1-L1',
    loopLengthM: 70,
    heatLoadWatts: 600,
    flowRateM3PerHour: 0.08,
  },
];

const underfloorHeating = buildUfhReport({
  rooms: [
    buildUfhRoom('r1', 'Комната', 1, {
      heatedAreaM2: 12,
      areaM2: 12,
      ufhTerminalControl: 'unibox',
      loops: defaultUfhLoops,
    }),
  ],
  totalHeatFluxUpWatts: 600,
  totalHeatFluxDownWatts: 120,
});

const demands = collectUniboxLoopDemands(underfloorHeating, {
  surveyInsideC: 20,
  rooms: [{ id: 'r1', type: 'гостиная' }],
});
assert.equal(demands.length, 1);
const demand0 = assertAt(demands, 0);
assert.equal(demand0.required.flowLph, 80);
assert.equal(demand0.required.requiredFit, 'eurocone');
assert.equal(demand0.required.roomAirTempC, 20);
assert.equal(demand0.required.roomAirTempSource, 'survey');
assert.equal(demand0.required.roomType, 'гостиная');
assert.ok(demand0.required.minKvM3h > 0);

// Санузел: T воздуха = 24 при анкете 20
const bathDemands = collectUniboxLoopDemands(underfloorHeating, {
  surveyInsideC: 20,
  rooms: [{ id: 'r1', type: 'санузел' }],
});
assert.equal(assertAt(bathDemands, 0).required.roomAirTempC, 24);
assert.equal(assertAt(bathDemands, 0).required.roomAirTempSource, 'preset');
assert.equal(assertAt(bathDemands, 0).required.roomType, 'санузел');

// Коридор / прихожая / тамбур: T воздуха = анкета
for (const type of ['коридор', 'прихожая', 'тамбур']) {
  const d = collectUniboxLoopDemands(underfloorHeating, {
    surveyInsideC: 20,
    rooms: [{ id: 'r1', type }],
  });
  assert.equal(assertAt(d, 0).required.roomAirTempC, 20, type);
  assert.equal(assertAt(d, 0).required.roomAirTempSource, 'survey', type);
}

// Без loops[] — порожньо (немає fallback length=0)
{
  const { loops: _omitLoops, ...roomNoLoops } = buildUfhRoom('r1', 'Комната', 2, {
    ufhTerminalControl: 'unibox',
    heatedAreaM2: 12,
    areaM2: 12,
  });
  void _omitLoops;
  const noLoops = collectUniboxLoopDemands(
    buildUfhReport({ rooms: [roomNoLoops] }),
    { surveyInsideC: 20 },
  );
  assert.equal(noLoops.length, 0);
}

/** @type {import('../src/catalog/types.js').NormalizedCatalog} */
const catalog = buildPartialCatalog({ uniboxes: UNIBOXES });

const report = pickUniboxes({
  catalog,
  underfloorHeating,
  roomAirTempC: 20,
  rooms: [{ id: 'r1', type: 'гостиная' }],
});
assert.equal(report.byLoop.length, 1);
assert.equal(assertAt(report.byLoop, 0).selected?.id, 'UB-RTL-AIR');
assert.equal(report.warnings.length, 0);

// Санузел + UB-LOW-AIR (maxAirTempC=22): при T воздуха 24 не подходит;
// pick берёт UB-RTL-AIR (maxAir 28). Если только LOW-AIR — selected null.
const onlyLowAir = pickUniboxes({
  catalog: buildPartialCatalog({ uniboxes: [uniboxAt(4)] }),
  underfloorHeating,
  roomAirTempC: 20,
  rooms: [{ id: 'r1', type: 'санузел' }],
});
assert.equal(assertAt(onlyLowAir.byLoop, 0).required.roomAirTempC, 24);
assert.equal(assertAt(onlyLowAir.byLoop, 0).selected, null);
assert.ok(onlyLowAir.warnings.length > 0);

// При анкете 20 и гостиной LOW-AIR подошёл бы (20 < 22)
const livingLowAir = pickUniboxes({
  catalog: buildPartialCatalog({ uniboxes: [uniboxAt(4)] }),
  underfloorHeating,
  roomAirTempC: 20,
  rooms: [{ id: 'r1', type: 'гостиная' }],
});
assert.equal(assertAt(livingLowAir.byLoop, 0).required.roomAirTempC, 20);
assert.equal(assertAt(livingLowAir.byLoop, 0).selected?.id, 'UB-LOW-AIR');

const empty = pickUniboxes({
  catalog: buildPartialCatalog({ uniboxes: [] }),
  underfloorHeating,
  roomAirTempC: 20,
});
assert.equal(assertAt(empty.byLoop, 0).selected, null);
assert.ok(empty.warnings.length > 0);

const noAir = pickUniboxes(/** @type {Parameters<typeof pickUniboxes>[0]} */ ({
  catalog,
  underfloorHeating,
}));
assert.deepEqual(noAir, { byLoop: [], warnings: [] });

// Invalid DT → selected null + warning
const badCircuitUfh = buildUfhReport({
  rooms: [
    buildUfhRoom('r1', 'Комната', 1, {
      heatedAreaM2: 12,
      areaM2: 12,
      ufhTerminalControl: 'unibox',
      circuitSupplyC: 30,
      circuitReturnC: 40,
      loops: defaultUfhLoops,
    }),
  ],
  totalHeatFluxUpWatts: 600,
  totalHeatFluxDownWatts: 120,
});
const badDtReport = pickUniboxes({
  catalog,
  underfloorHeating: badCircuitUfh,
  roomAirTempC: 20,
  rooms: [{ id: 'r1', type: 'гостиная' }],
});
assert.equal(badDtReport.byLoop.length, 1);
assert.equal(assertAt(badDtReport.byLoop, 0).selected, null);
assert.ok(badDtReport.warnings.some((w) => w.includes('обратка') || w.includes('UNIBOX') || w.includes('<')));

// >2 петель з явним unibox — підбір триває, м'яке попередження
const manyLoopsRoom = buildUfhReport({
  rooms: [
    buildUfhRoom('r1', 'Комната', 3, {
      heatedAreaM2: 12,
      areaM2: 12,
      ufhTerminalControl: 'unibox',
      loops: [
        { loopId: 'a', loopLengthM: 40, heatLoadWatts: 200, flowRateM3PerHour: 0.03 },
        { loopId: 'b', loopLengthM: 40, heatLoadWatts: 200, flowRateM3PerHour: 0.03 },
        { loopId: 'c', loopLengthM: 40, heatLoadWatts: 200, flowRateM3PerHour: 0.03 },
      ],
    }),
  ],
  totalHeatFluxUpWatts: 600,
  totalHeatFluxDownWatts: 120,
});
const tooMany = pickUniboxes({
  catalog,
  underfloorHeating: manyLoopsRoom,
  roomAirTempC: 20,
});
assert.equal(tooMany.byLoop.length, 3);
assert.ok(tooMany.warnings.some((w) => w.includes('унибоксом')));

// Каскад коллекторов не блокує явні unibox-зони
assert.equal(
  hasUnderfloorManifoldCascade({
    ok: true,
    underfloor: [
      {
        floor: 1,
        requiredOutlets: 14,
        units: [
          { index: 1, requiredOutlets: 7, selected: null, warnings: [] },
          { index: 2, requiredOutlets: 7, selected: null, warnings: [] },
        ],
        warnings: [],
      },
    ],
    radiator: null,
    boilerManifold: null,
    warnings: [],
  }),
  true,
);
const cascadeStillMatches = pickUniboxes({
  catalog,
  underfloorHeating,
  roomAirTempC: 20,
  rooms: [{ id: 'r1', type: 'гостиная' }],
  manifolds: {
    ok: true,
    underfloor: [
      {
        floor: 1,
        requiredOutlets: 14,
        units: [
          { index: 1, requiredOutlets: 7, selected: null, warnings: [] },
          { index: 2, requiredOutlets: 7, selected: null, warnings: [] },
        ],
        warnings: [],
      },
    ],
    radiator: null,
    boilerManifold: null,
    warnings: [],
  },
});
assert.equal(cascadeStillMatches.byLoop.length, 1);
assert.ok(assertAt(cascadeStillMatches.byLoop, 0).selected);

// collector-термінал → demands порожні
const collectorOnly = buildUfhReport({
  rooms: [
    buildUfhRoom('r1', 'Комната', 1, {
      heatedAreaM2: 12,
      areaM2: 12,
      ufhTerminalControl: 'collector',
      loops: defaultUfhLoops,
    }),
  ],
  totalHeatFluxUpWatts: 600,
  totalHeatFluxDownWatts: 120,
});
assert.equal(
  collectUniboxLoopDemands(collectorOnly, {
    surveyInsideC: 20,
    rooms: [{ id: 'r1', type: 'гостиная' }],
  }).length,
  0,
);

// Змішаний об'єкт: лише санузел з unibox
const mixedUfh = buildUfhReport({
  rooms: [
    buildUfhRoom('r2', 'Комната', 1, {
      heatedAreaM2: 12,
      areaM2: 12,
      ufhTerminalControl: 'collector',
      loops: defaultUfhLoops,
    }),
    buildUfhRoom('r4', 'Санузел', 1, {
      heatedAreaM2: 3.8,
      areaM2: 3.8,
      ufhTerminalControl: 'unibox',
      loops: [
        {
          loopId: 'r4-L1',
          loopLengthM: 38,
          heatLoadWatts: 200,
          flowRateM3PerHour: 0.02,
        },
      ],
    }),
  ],
  totalHeatFluxUpWatts: 600,
  totalHeatFluxDownWatts: 120,
});
const mixedPick = pickUniboxes({
  catalog,
  underfloorHeating: mixedUfh,
  roomAirTempC: 20,
  rooms: [
    { id: 'r2', type: 'гостиная' },
    { id: 'r4', type: 'санузел' },
  ],
});
assert.equal(mixedPick.byLoop.length, 1);
assert.equal(assertAt(mixedPick.byLoop, 0).roomId, 'r4');
assert.ok(assertAt(mixedPick.byLoop, 0).selected);

// Soft-fail коллекторов / битые manifolds — не TypeError, не cascade-skip
assert.equal(hasUnderfloorManifoldCascade(null), false);
assert.equal(hasUnderfloorManifoldCascade(undefined), false);
assert.equal(
  hasUnderfloorManifoldCascade(/** @type {import('../src/types/shared-types.js').ManifoldsMatchingReport} */ (/** @type {unknown} */ ({
    ok: true,
    underfloor: [null],
    radiator: null,
    boilerManifold: null,
    warnings: [],
  }))),
  false,
);
assert.equal(
  hasUnderfloorManifoldCascade(/** @type {import('../src/types/shared-types.js').ManifoldsMatchingReport} */ (/** @type {unknown} */ ({
    ok: true,
    underfloor: [{ floor: 1, requiredOutlets: 2, units: undefined, warnings: [] }],
    radiator: null,
    boilerManifold: null,
    warnings: [],
  }))),
  false,
);

const degraded = /** @type {import('../src/types/shared-types.js').ManifoldsMatchingReport} */ ({
  ok: false,
  failureCode: 'MANIFOLD_INTERNAL',
  underfloor: [],
  radiator: null,
  boilerManifold: null,
  warnings: ['Коллекторы: подбор не выполнен (MANIFOLD_INTERNAL).'],
});
assert.equal(hasUnderfloorManifoldCascade(degraded), false);

const degradedPick = pickUniboxes({
  catalog,
  underfloorHeating,
  roomAirTempC: 20,
  manifolds: degraded,
  rooms: [{ id: 'r1', type: 'гостиная' }],
});
assert.ok(degradedPick.byLoop.length >= 1);
assert.ok(!degradedPick.warnings.some((w) => w.includes('Унибоксы не подбираются: каскад')));
const degradedInfo = degradedPick.warnings.find((w) =>
  w.includes('Подбор унибоксов выполняется без сигнала каскада коллекторов'),
);
assert.ok(degradedInfo, 'блок-рівень warning про soft-fail колекторів');
assert.ok(degradedInfo.includes('manifolds.ok=false'));
assert.ok(degradedInfo.includes('MANIFOLD_INTERNAL'));
const byLoopWarnFlat = degradedPick.byLoop.flatMap((r) => r.warnings);
assert.ok(
  !byLoopWarnFlat.some((w) => w.includes('без сигнала каскада')),
  'degraded-warning лише в matching.uniboxes.warnings, не в byLoop',
);
assert.ok(assertAt(degradedPick.byLoop, 0).selected);

const nullManifoldsPick = pickUniboxes({
  catalog,
  underfloorHeating,
  roomAirTempC: 20,
  manifolds: null,
  rooms: [{ id: 'r1', type: 'гостиная' }],
});
assert.ok(nullManifoldsPick.byLoop.length >= 1);

// Нульовий витрата петлі (теплопотери/flow=0) → selected null + UNIBOX_FLOW
const zeroFlowUfh = buildUfhReport({
  rooms: [
    buildUfhRoom('r1', 'Комната', 1, {
      heatedAreaM2: 12,
      areaM2: 12,
      ufhTerminalControl: 'unibox',
      loops: [
        {
          loopId: 'r1-L0',
          loopLengthM: 40,
          heatLoadWatts: 0,
          flowRateM3PerHour: 0,
        },
      ],
    }),
  ],
  totalHeatFluxUpWatts: 600,
  totalHeatFluxDownWatts: 120,
});
const zeroFlowPick = pickUniboxes({
  catalog,
  underfloorHeating: zeroFlowUfh,
  roomAirTempC: 20,
  rooms: [{ id: 'r1', type: 'гостиная' }],
});
assert.equal(zeroFlowPick.byLoop.length, 1);
assert.equal(assertAt(zeroFlowPick.byLoop, 0).selected, null);
assert.ok(
  assertAt(zeroFlowPick.byLoop, 0).warnings.some((w) => w.includes('расход') || w.includes('л/ч')),
);

// --- Пул лише з validated catalog.uniboxes (omit опціональних полів, без NaN) ---
const rawUniboxEnvelope = catalogEnvelopeWithUniboxes([
  {
    id: 'UB-BAL',
    brand: 'Test',
    model: 'BalOnly',
    type: 'balancing_valve',
    loopsCount: 1,
    maxAreaSqM: 20,
    maxLoopLengthM: 100,
    maxTemperatureC: 90,
    maxPressureBar: 10,
    kvM3h: 1.2,
    connection: { thread: 'G3/4', fit: 'eurocone' },
    material: 'Латунь',
    price: 2500,
    // omit: min/maxAir, coolant, flow, maxSupply — паспорт balancing_valve
  },
  {
    id: 'UB-RTL-LEGACY',
    brand: 'Test',
    model: 'RtlLegacyKeys',
    type: 'rtl_air',
    loopsCount: 1,
    maxAreaSqM: 20,
    maxLoopLengthM: 80,
    minAirTempC: 6,
    maxAirTempC: 28,
    minCoolantTempC: 10,
    maxCoolantTempC: 50,
    maxTemperatureC: 90,
    maxPressureBar: 10,
    kvM3h: 1.1,
    kvs: 1.1, // legacy — validateUnibox видаляє
    connection: { thread: 'G3/4', fit: 'eurocone' },
    material: 'Латунь',
    price: 4000,
  },
]);
const normalizedPool = validateAndNormalizeCatalog(rawUniboxEnvelope);
const normalizedUniboxes = assertDefined(normalizedPool.uniboxes, 'normalizedPool.uniboxes');
assert.equal(normalizedUniboxes.length, 2);
const bal = assertDefined(
  normalizedUniboxes.find((u) => u.id === 'UB-BAL'),
  'UB-BAL',
);
const rtlLegacy = assertDefined(
  normalizedUniboxes.find((u) => u.id === 'UB-RTL-LEGACY'),
  'UB-RTL-LEGACY',
);
assert.equal(Object.hasOwn(bal, 'minAirTempC'), false);
assert.equal(Object.hasOwn(bal, 'maxAirTempC'), false);
assert.equal(Object.hasOwn(bal, 'minCoolantTempC'), false);
assert.equal(Object.hasOwn(bal, 'minFlowLph'), false);
assert.equal(Object.hasOwn(bal, 'maxSupplyTempC'), false);
assert.equal(Object.hasOwn(rtlLegacy, 'kvs'), false);
assert.equal(uniboxFitsDemand(bal, demandOk), true);
assert.equal(uniboxFitsDemand(rtlLegacy, demandOk), true);

const fromValidated = pickUniboxes({
  catalog: buildPartialCatalog({ uniboxes: normalizedUniboxes }),
  underfloorHeating,
  roomAirTempC: 20,
  rooms: [{ id: 'r1', type: 'гостиная' }],
});
assert.equal(fromValidated.byLoop.length, 1);
assert.ok(assertAt(fromValidated.byLoop, 0).selected);
assert.equal(assertAt(fromValidated.byLoop, 0).selected?.id, 'UB-RTL-LEGACY');

const balOnlyPick = pickUniboxes({
  catalog: buildPartialCatalog({ uniboxes: [bal] }),
  underfloorHeating,
  roomAirTempC: 20,
  rooms: [{ id: 'r1', type: 'гостиная' }],
});
assert.ok(assertAt(balOnlyPick.byLoop, 0).selected);
assert.equal(assertAt(balOnlyPick.byLoop, 0).selected?.id, 'UB-BAL');

console.log('verify:unibox-matching OK');
