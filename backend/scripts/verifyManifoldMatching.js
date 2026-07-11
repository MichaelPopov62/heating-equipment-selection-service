/**
 * Назначение: verify підбору колекторів (matching/manifold.js).
 * Опис: outletsCount / circuitsCount, house vs apartment, каскад >12 петель, fallback.
 */

import assert from 'node:assert/strict';
import {
  pickBoilerManifold,
  pickDistributionManifold,
  pickManifolds,
  splitOutletsForCascade,
  UFH_MANIFOLD_MAX_OUTLETS_PER_NODE,
} from '../src/matching/manifold.js';

assert.equal(UFH_MANIFOLD_MAX_OUTLETS_PER_NODE, 12);
assert.deepEqual(splitOutletsForCascade(5), [5]);
assert.deepEqual(splitOutletsForCascade(12), [12]);
assert.deepEqual(splitOutletsForCascade(13), [7, 6]);
assert.deepEqual(splitOutletsForCascade(14), [7, 7]);
assert.deepEqual(splitOutletsForCascade(25), [9, 8, 8]);

/** @type {import('../src/catalog/types').ManifoldCatalogItemNormalized[]} */
const MANIFOLDS = [
  {
    model: 'Rad-3',
    brand: 'T',
    article: 'R3',
    price: 1000,
    outletsCount: 3,
    manifoldApplication: 'radiator',
    hasFlowMeters: false,
    material: 'латунь',
    maxPressureBar: 10,
    maxTemperatureC: 110,
    connectionMainInch: '1',
    connectionOutletsInch: '3/4',
    dimensions: { width: 300, height: 400, depth: 100 },
  },
  {
    model: 'Rad-5',
    brand: 'T',
    article: 'R5',
    price: 1500,
    outletsCount: 5,
    manifoldApplication: 'radiator',
    hasFlowMeters: false,
    material: 'латунь',
    maxPressureBar: 10,
    maxTemperatureC: 110,
    connectionMainInch: '1',
    connectionOutletsInch: '3/4',
    dimensions: { width: 400, height: 400, depth: 100 },
  },
  {
    model: 'Ufh-4',
    brand: 'T',
    article: 'U4',
    price: 2000,
    outletsCount: 4,
    manifoldApplication: 'underfloor',
    hasFlowMeters: false,
    material: 'латунь',
    maxPressureBar: 10,
    maxTemperatureC: 110,
    connectionMainInch: '1',
    connectionOutletsInch: '3/4',
    dimensions: { width: 350, height: 400, depth: 100 },
  },
  {
    model: 'Ufh-5-FM',
    brand: 'T',
    article: 'U5',
    price: 2500,
    outletsCount: 5,
    manifoldApplication: 'underfloor',
    hasFlowMeters: true,
    material: 'латунь',
    maxPressureBar: 10,
    maxTemperatureC: 110,
    connectionMainInch: '1',
    connectionOutletsInch: '3/4',
    dimensions: { width: 400, height: 400, depth: 100 },
  },
  {
    model: 'Ufh-7-FM',
    brand: 'T',
    article: 'U7',
    price: 3000,
    outletsCount: 7,
    manifoldApplication: 'underfloor',
    hasFlowMeters: true,
    material: 'латунь',
    maxPressureBar: 10,
    maxTemperatureC: 110,
    connectionMainInch: '1',
    connectionOutletsInch: '3/4',
    dimensions: { width: 450, height: 400, depth: 100 },
  },
  {
    model: 'Ufh-10',
    brand: 'T',
    article: 'U10',
    price: 4000,
    outletsCount: 10,
    manifoldApplication: 'underfloor',
    hasFlowMeters: true,
    material: 'латунь',
    maxPressureBar: 10,
    maxTemperatureC: 110,
    connectionMainInch: '1',
    connectionOutletsInch: '3/4',
    dimensions: { width: 600, height: 400, depth: 100 },
  },
  {
    model: 'Ufh-12-FM',
    brand: 'T',
    article: 'U12',
    price: 5000,
    outletsCount: 12,
    manifoldApplication: 'underfloor',
    hasFlowMeters: true,
    material: 'латунь',
    maxPressureBar: 10,
    maxTemperatureC: 110,
    connectionMainInch: '1',
    connectionOutletsInch: '3/4',
    dimensions: { width: 700, height: 400, depth: 100 },
  },
];

/** @type {import('../src/catalog/types').BoilerManifoldCatalogItemNormalized[]} */
const BOILER_MANIFOLDS = [
  {
    model: 'BM-3',
    brand: 'F',
    article: 'B3',
    price: 10000,
    circuitsCount: 3,
    maxPowerKw: 85,
    hasInsulation: true,
    interaxleDistanceMm: 125,
    connectionBoilerInch: '1 1/2',
    connectionCircuitsInch: '1 1/2',
    maxPressureBar: 6,
    maxTemperatureC: 100,
    material: 'сталь',
    dimensions: { width: 500, height: 180, depth: 135 },
  },
  {
    model: 'BM-5',
    brand: 'F',
    article: 'B5',
    price: 15000,
    circuitsCount: 5,
    maxPowerKw: 85,
    hasInsulation: true,
    interaxleDistanceMm: 125,
    connectionBoilerInch: '1 1/2',
    connectionCircuitsInch: '1 1/2',
    maxPressureBar: 6,
    maxTemperatureC: 100,
    material: 'сталь',
    dimensions: { width: 750, height: 180, depth: 135 },
  },
];

/** @type {import('../src/catalog/types').NormalizedCatalog} */
const catalog = {
  boilers: { doubleCircuit: [], singleCircuit: [] },
  radiators: [],
  waterHeaters: [],
  manifolds: MANIFOLDS,
  boilerManifolds: BOILER_MANIFOLDS,
};

/**
 * @param {string} roomId
 * @param {string} roomName
 * @param {number} loopsCount
 * @returns {import('../src/types/shared-types').UnderfloorHeatingRoomReport}
 */
function ufhRoom(roomId, roomName, loopsCount) {
  return {
    roomId,
    roomName,
    loopsCount,
    heatFluxUpWatts: 1000,
    heatFluxDownWatts: 100,
    heatFluxUpWm2: 80,
    heatFluxDownWm2: 8,
    maxAllowableHeatFluxUpWm2: 100,
    surfaceTempC: 26,
    maxSurfaceTemperatureCelsius: 29,
    pipeSpacingMm: 150,
    pipeEmbedmentResistanceM2KW: 0.05,
    baseCoveringResistanceM2KW: 0,
    finishCoveringResistanceM2KW: 0.05,
    coveringResistanceM2KW: 0.05,
    resistanceUpM2KW: 0.1,
    resistanceDownM2KW: 0.5,
    circuitSupplyC: 40,
    circuitReturnC: 30,
    circuitMeanC: 35,
    bottomBoundary: 'heated',
    neighborTempC: 20,
    warnings: [],
    heatedAreaM2: 12,
    areaM2: 12,
  };
}

// 1) ТП: 5 петель → мінімальний underfloor з ≥5 і hasFlowMeters
{
  const pick = pickDistributionManifold({
    catalog,
    application: 'underfloor',
    requiredOutlets: 5,
  });
  assert.equal(pick.selected?.model, 'Ufh-5-FM');
  assert.equal(pick.warnings.length, 0);
}

// 2) Потреба 13 на один pick без каскаду → fallback max 12 + warning (unit-level)
{
  const pick = pickDistributionManifold({
    catalog,
    application: 'underfloor',
    requiredOutlets: 13,
  });
  assert.equal(pick.selected?.model, 'Ufh-12-FM');
  assert.ok(pick.warnings.length >= 1);
}

// 3) apartment + ТП → underfloor є, boilerManifold = null; 1 unit
{
  const report = pickManifolds({
    catalog,
    building: {
      objectMeta: { objectType: 'apartment', floors: 1, roomsCount: 2 },
      rooms: [
        { id: 'r1', name: 'Кімната', type: 'living', floor: 1, topBoundary: 'heated', areaM2: 12, heightM: 2.7 },
      ],
    },
    underfloorHeating: {
      enabled: true,
      circuitSupplyC: 40,
      circuitReturnC: 30,
      circuitMeanC: 35,
      circuitSource: 'finish_preset',
      distributionPreset: 'collector_mixing_valve',
      rooms: [ufhRoom('r1', 'Кімната', 5)],
      totalHeatFluxUpWatts: 1000,
      totalHeatFluxDownWatts: 100,
    },
    radiators: { chosen: null, byRoom: [], warnings: [] },
    boiler: { requiredKw: 12, warnings: [] },
    hydraulics: { radiatorWiringSystemType: 'auto' },
  });
  assert.equal(report.underfloor.length, 1);
  assert.equal(report.underfloor[0].requiredOutlets, 5);
  assert.equal(report.underfloor[0].units.length, 1);
  assert.equal(report.underfloor[0].units[0].selected?.model, 'Ufh-5-FM');
  assert.equal(report.boilerManifold, null);
  assert.equal(report.radiator, null);
}

// 4) house + hydraulic_separator → boilerManifold
{
  const report = pickManifolds({
    catalog,
    building: {
      objectMeta: { objectType: 'house', floors: 1, roomsCount: 2 },
      rooms: [
        { id: 'r1', name: 'Зал', type: 'living', floor: 1, topBoundary: 'heated', areaM2: 20, heightM: 2.7 },
        { id: 'r2', name: 'Спальня', type: 'living', floor: 1, topBoundary: 'heated', areaM2: 15, heightM: 2.7 },
      ],
    },
    underfloorHeating: {
      enabled: true,
      circuitSupplyC: 40,
      circuitReturnC: 30,
      circuitMeanC: 35,
      circuitSource: 'finish_preset',
      distributionPreset: 'hydraulic_separator',
      rooms: [ufhRoom('r1', 'Зал', 4)],
      totalHeatFluxUpWatts: 2000,
      totalHeatFluxDownWatts: 200,
    },
    radiators: {
      chosen: null,
      byRoom: [
        {
          roomId: 'r2',
          roomName: 'Спальня',
          heatLossWatts: 800,
          radiatorDesignWatts: 880,
          radiatorModel: 'X',
          outputPerSectionWatts: 150,
          sections: 6,
        },
      ],
      warnings: [],
    },
    boiler: { requiredKw: 24, warnings: [] },
    hydraulics: { radiatorWiringSystemType: 'auto' },
  });
  assert.ok(report.boilerManifold);
  assert.equal(report.boilerManifold.requiredCircuits, 2);
  assert.equal(report.boilerManifold.requiredPowerKw, 24);
  assert.equal(report.boilerManifold.selected?.model, 'BM-3');
  assert.equal(report.underfloor[0].units[0].selected?.model, 'Ufh-5-FM');
}

// 5) radiator wiring = manifold
{
  const report = pickManifolds({
    catalog,
    building: {
      objectMeta: { objectType: 'house', floors: 1, roomsCount: 3 },
      rooms: [
        { id: 'a', name: 'A', type: 'living', floor: 1, topBoundary: 'heated', areaM2: 10, heightM: 2.7 },
        { id: 'b', name: 'B', type: 'living', floor: 1, topBoundary: 'heated', areaM2: 10, heightM: 2.7 },
        { id: 'c', name: 'C', type: 'living', floor: 1, topBoundary: 'heated', areaM2: 10, heightM: 2.7 },
      ],
    },
    underfloorHeating: null,
    radiators: {
      chosen: null,
      byRoom: [
        { roomId: 'a', roomName: 'A', heatLossWatts: 500, radiatorDesignWatts: 550, radiatorModel: 'X', outputPerSectionWatts: 150, sections: 4 },
        { roomId: 'b', roomName: 'B', heatLossWatts: 500, radiatorDesignWatts: 550, radiatorModel: 'X', outputPerSectionWatts: 150, sections: 4 },
        { roomId: 'c', roomName: 'C', heatLossWatts: 500, radiatorDesignWatts: 550, radiatorModel: 'X', outputPerSectionWatts: 150, sections: 4 },
      ],
      warnings: [],
    },
    boiler: { requiredKw: 10, warnings: [] },
    hydraulics: { radiatorWiringSystemType: 'manifold' },
  });
  assert.ok(report.radiator);
  assert.equal(report.radiator.requiredOutlets, 3);
  assert.equal(report.radiator.selected?.model, 'Rad-3');
  assert.equal(report.underfloor.length, 0);
  assert.equal(report.boilerManifold, null);
}

// 6) порожній пул → warning, selected null
{
  const empty = {
    boilers: { doubleCircuit: [], singleCircuit: [] },
    radiators: [],
    waterHeaters: [],
    manifolds: [],
    boilerManifolds: [],
  };
  const d = pickDistributionManifold({
    catalog: empty,
    application: 'underfloor',
    requiredOutlets: 4,
  });
  assert.equal(d.selected, null);
  assert.ok(d.warnings.length >= 1);

  const b = pickBoilerManifold({
    catalog: empty,
    requiredCircuits: 2,
    requiredPowerKw: 20,
  });
  assert.equal(b.selected, null);
  assert.ok(b.warnings.length >= 1);
}

// 7) два поверхи ТП → два елементи underfloor (по 1 unit)
{
  const report = pickManifolds({
    catalog,
    building: {
      objectMeta: { objectType: 'house', floors: 2, roomsCount: 2 },
      rooms: [
        { id: 'f1', name: '1п', type: 'living', floor: 1, topBoundary: 'heated', areaM2: 15, heightM: 2.7 },
        { id: 'f2', name: '2п', type: 'living', floor: 2, topBoundary: 'roof', areaM2: 15, heightM: 2.7 },
      ],
    },
    underfloorHeating: {
      enabled: true,
      circuitSupplyC: 40,
      circuitReturnC: 30,
      circuitMeanC: 35,
      circuitSource: 'finish_preset',
      distributionPreset: 'collector_mixing_valve',
      rooms: [
        ufhRoom('f1', '1п', 3),
        ufhRoom('f2', '2п', 5),
      ],
      totalHeatFluxUpWatts: 2000,
      totalHeatFluxDownWatts: 200,
    },
    radiators: { chosen: null, byRoom: [], warnings: [] },
    boiler: { requiredKw: 15, warnings: [] },
    hydraulics: {},
  });
  assert.equal(report.underfloor.length, 2);
  assert.equal(report.underfloor[0].floor, 1);
  assert.equal(report.underfloor[0].requiredOutlets, 3);
  assert.equal(report.underfloor[0].units.length, 1);
  assert.equal(report.underfloor[1].floor, 2);
  assert.equal(report.underfloor[1].requiredOutlets, 5);
  assert.equal(report.underfloor[1].units[0].selected?.model, 'Ufh-5-FM');
}

// 8) 12 петель → 1 unit, без cascade warning
{
  const report = pickManifolds({
    catalog,
    building: {
      objectMeta: { objectType: 'house', floors: 1, roomsCount: 1 },
      rooms: [
        { id: 'r1', name: 'Зал', type: 'living', floor: 1, topBoundary: 'heated', areaM2: 40, heightM: 2.7 },
      ],
    },
    underfloorHeating: {
      enabled: true,
      circuitSupplyC: 40,
      circuitReturnC: 30,
      circuitMeanC: 35,
      circuitSource: 'finish_preset',
      distributionPreset: 'collector_mixing_valve',
      rooms: [ufhRoom('r1', 'Зал', 12)],
      totalHeatFluxUpWatts: 3000,
      totalHeatFluxDownWatts: 300,
    },
    radiators: { chosen: null, byRoom: [], warnings: [] },
    boiler: { requiredKw: 20, warnings: [] },
    hydraulics: {},
  });
  assert.equal(report.underfloor[0].units.length, 1);
  assert.equal(report.underfloor[0].units[0].requiredOutlets, 12);
  assert.equal(report.underfloor[0].units[0].selected?.model, 'Ufh-12-FM');
  assert.ok(!report.warnings.some((w) => w.includes('Превышен лимит петель')));
}

// 9) 14 петель → каскад 7+7, warning, два SKU
{
  const report = pickManifolds({
    catalog,
    building: {
      objectMeta: { objectType: 'house', floors: 1, roomsCount: 1 },
      rooms: [
        { id: 'r1', name: 'Зал', type: 'living', floor: 1, topBoundary: 'heated', areaM2: 50, heightM: 2.7 },
      ],
    },
    underfloorHeating: {
      enabled: true,
      circuitSupplyC: 40,
      circuitReturnC: 30,
      circuitMeanC: 35,
      circuitSource: 'finish_preset',
      distributionPreset: 'collector_mixing_valve',
      rooms: [ufhRoom('r1', 'Зал', 14)],
      totalHeatFluxUpWatts: 4000,
      totalHeatFluxDownWatts: 400,
    },
    radiators: { chosen: null, byRoom: [], warnings: [] },
    boiler: { requiredKw: 24, warnings: [] },
    hydraulics: {},
  });
  const floorPick = report.underfloor[0];
  assert.equal(floorPick.requiredOutlets, 14);
  assert.equal(floorPick.units.length, 2);
  assert.equal(floorPick.units[0].requiredOutlets, 7);
  assert.equal(floorPick.units[1].requiredOutlets, 7);
  assert.equal(floorPick.units[0].selected?.model, 'Ufh-7-FM');
  assert.equal(floorPick.units[1].selected?.model, 'Ufh-7-FM');
  assert.ok(
    report.warnings.some(
      (w) =>
        w.includes('Превышен лимит петель на один узел (max 12)')
        && w.includes('на 2 коллектора')
        && w.includes('7+7'),
    ),
  );
}

// 10) 25 петель → 3 units (9+8+8)
{
  const report = pickManifolds({
    catalog,
    building: {
      objectMeta: { objectType: 'house', floors: 1, roomsCount: 1 },
      rooms: [
        { id: 'r1', name: 'Зал', type: 'living', floor: 1, topBoundary: 'heated', areaM2: 80, heightM: 2.7 },
      ],
    },
    underfloorHeating: {
      enabled: true,
      circuitSupplyC: 40,
      circuitReturnC: 30,
      circuitMeanC: 35,
      circuitSource: 'finish_preset',
      distributionPreset: 'collector_mixing_valve',
      rooms: [ufhRoom('r1', 'Зал', 25)],
      totalHeatFluxUpWatts: 6000,
      totalHeatFluxDownWatts: 600,
    },
    radiators: { chosen: null, byRoom: [], warnings: [] },
    boiler: { requiredKw: 30, warnings: [] },
    hydraulics: {},
  });
  const units = report.underfloor[0].units;
  assert.equal(units.length, 3);
  assert.deepEqual(
    units.map((u) => u.requiredOutlets),
    [9, 8, 8],
  );
  assert.ok(report.warnings.some((w) => w.includes('на 3 коллектора') && w.includes('9+8+8')));
}

console.log('verify:manifold-matching OK');
