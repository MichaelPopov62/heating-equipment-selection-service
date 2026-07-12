/**
 * Назначение: verify подбора унибоксов (полный паспортный фильтр + бизнес-гейт) без HTTP.
 * Запуск: npm run verify:unibox-matching
 */
import assert from 'node:assert/strict';
import {
  UNIBOX_DESIGN_PRESSURE_BAR,
  UNIBOX_REQUIRED_FIT,
  collectUniboxLoopDemands,
  hasUnderfloorManifoldCascade,
  minKvM3hForFlowLph,
  pickUniboxForDemand,
  pickUniboxes,
  uniboxFitsDemand,
} from '../src/matching/unibox.js';

/** @type {import('../src/catalog/types').UniboxCatalogItemNormalized[]} */
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

assert.equal(uniboxFitsDemand(UNIBOXES[0], demandOk), true);
assert.equal(uniboxFitsDemand(UNIBOXES[2], { ...demandOk, circuitSupplyC: 50 }), false);
assert.equal(uniboxFitsDemand(UNIBOXES[1], { ...demandOk, flowLph: 250, minKvM3h: minKvM3hForFlowLph(250) }), false);
assert.equal(uniboxFitsDemand(UNIBOXES[0], { ...demandOk, roomAirTempC: 35 }), false);
assert.equal(uniboxFitsDemand(UNIBOXES[0], { ...demandOk, systemPressureBar: 16 }), false);
assert.equal(uniboxFitsDemand(UNIBOXES[3], demandOk), false); // fit !== eurocone
assert.equal(uniboxFitsDemand(UNIBOXES[0], { ...demandOk, loopLengthM: 0 }), false);

const picked = pickUniboxForDemand(UNIBOXES, demandOk);
assert.ok(picked);
assert.equal(picked.id, 'UB-RTL-AIR');

const underfloorHeating = {
  enabled: true,
  circuitSupplyC: 40,
  circuitReturnC: 30,
  circuitMeanC: 35,
  circuitSource: 'finish_preset',
  rooms: [
    {
      roomId: 'r1',
      roomName: 'Комната',
      basePresetId: 'x',
      finishMaterialId: 'ceramic_tile',
      roomAreaM2: 15,
      furnitureOccupiedAreaM2: 0,
      heatedAreaM2: 12,
      requestedPipeSpacingMm: 150,
      resolvedPipeSpacingMm: 150,
      pipeSpacingResolution: 'as_requested',
      areaM2: 12,
      pipeSpacingMm: 150,
      pipeEmbedmentResistanceM2KW: 0,
      baseCoveringResistanceM2KW: 0,
      finishCoveringResistanceM2KW: 0,
      coveringResistanceM2KW: 0,
      resistanceUpM2KW: 0,
      resistanceDownM2KW: 0,
      circuitSupplyC: 40,
      circuitReturnC: 30,
      circuitMeanC: 35,
      heatFluxUpWm2: 50,
      heatFluxDownWm2: 10,
      maxAllowableHeatFluxUpWm2: 100,
      heatFluxUpWatts: 600,
      heatFluxDownWatts: 120,
      surfaceTempC: 26,
      maxSurfaceTemperatureCelsius: 29,
      bottomBoundary: 'heated',
      neighborTempC: 20,
      warnings: [],
      loops: [
        {
          loopId: 'r1-L1',
          loopLengthM: 70,
          heatLoadWatts: 600,
          flowRateM3PerHour: 0.08,
        },
      ],
    },
  ],
  totalHeatFluxUpWatts: 600,
  totalHeatFluxDownWatts: 120,
  warnings: [],
};

const demands = collectUniboxLoopDemands(underfloorHeating, { roomAirTempC: 20 });
assert.equal(demands.length, 1);
assert.equal(demands[0].required.flowLph, 80);
assert.equal(demands[0].required.requiredFit, 'eurocone');
assert.ok(demands[0].required.minKvM3h > 0);

// Без loops[] — порожньо (немає fallback length=0)
const noLoops = collectUniboxLoopDemands(
  { ...underfloorHeating, rooms: [{ ...underfloorHeating.rooms[0], loops: undefined, loopsCount: 2 }] },
  { roomAirTempC: 20 },
);
assert.equal(noLoops.length, 0);

const catalog = {
  boilers: { doubleCircuit: [], singleCircuit: [] },
  radiators: [],
  waterHeaters: [],
  uniboxes: UNIBOXES,
};

const report = pickUniboxes({
  catalog,
  underfloorHeating,
  roomAirTempC: 20,
});
assert.equal(report.byLoop.length, 1);
assert.equal(report.byLoop[0].selected?.id, 'UB-RTL-AIR');
assert.equal(report.warnings.length, 0);

const empty = pickUniboxes({
  catalog: { ...catalog, uniboxes: [] },
  underfloorHeating,
  roomAirTempC: 20,
});
assert.equal(empty.byLoop[0].selected, null);
assert.ok(empty.warnings.length > 0);

const noAir = pickUniboxes({ catalog, underfloorHeating });
assert.deepEqual(noAir, { byLoop: [], warnings: [] });

// >2 петель → skip
const manyLoopsRoom = {
  ...underfloorHeating,
  rooms: [
    {
      ...underfloorHeating.rooms[0],
      loops: [
        { loopId: 'a', loopLengthM: 40, heatLoadWatts: 200, flowRateM3PerHour: 0.03 },
        { loopId: 'b', loopLengthM: 40, heatLoadWatts: 200, flowRateM3PerHour: 0.03 },
        { loopId: 'c', loopLengthM: 40, heatLoadWatts: 200, flowRateM3PerHour: 0.03 },
      ],
    },
  ],
};
const tooMany = pickUniboxes({ catalog, underfloorHeating: manyLoopsRoom, roomAirTempC: 20 });
assert.equal(tooMany.byLoop.length, 0);
assert.ok(tooMany.warnings.some((w) => w.includes('петель')));

// Каскад коллекторов → skip
assert.equal(
  hasUnderfloorManifoldCascade({
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
const cascadeSkip = pickUniboxes({
  catalog,
  underfloorHeating,
  roomAirTempC: 20,
  manifolds: {
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
assert.equal(cascadeSkip.byLoop.length, 0);
assert.ok(cascadeSkip.warnings.some((w) => w.includes('каскад')));

console.log('verify:unibox-matching OK');
