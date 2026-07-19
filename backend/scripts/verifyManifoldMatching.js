/**
 * Назначение: verify підбору колекторів (matching/manifold.js).
 * Опис: outletsCount / circuitsCount, house vs apartment, каскад >12 петель, fallback.
 */

import assert from 'node:assert/strict';
import {
  pickBoilerManifold,
  pickDistributionManifold,
  pickManifolds,
  pickManifoldsWithCore,
  buildEmptyManifoldsFailure,
  buildOkManifoldsReport,
  splitOutletsForCascade,
  UFH_MANIFOLD_MAX_OUTLETS_PER_NODE,
  MANIFOLD_FAILURE_CODE_INTERNAL,
  MANIFOLD_FAILURE_CODE_INPUT,
} from '../src/matching/manifold.js';
import { logger } from '../src/utils/logger.js';
import { assertAt } from './fixtures/scriptAssert.js';
import {
  buildObjectMeta,
  buildPartialCatalog,
  buildBuildingInput,
  buildRoom,
  buildUfhReport,
  buildUfhRoom,
} from './fixtures/verifyFixtures.js';

assert.equal(UFH_MANIFOLD_MAX_OUTLETS_PER_NODE, 12);
assert.deepEqual(splitOutletsForCascade(5), [5]);
assert.deepEqual(splitOutletsForCascade(12), [12]);
assert.deepEqual(splitOutletsForCascade(13), [7, 6]);
assert.deepEqual(splitOutletsForCascade(14), [7, 7]);
assert.deepEqual(splitOutletsForCascade(25), [9, 8, 8]);

/** @type {import('../src/catalog/types.js').ManifoldCatalogItemNormalized[]} */
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

/** @type {import('../src/catalog/types.js').BoilerManifoldCatalogItemNormalized[]} */
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

/** @type {import('../src/catalog/types.js').NormalizedCatalog} */
const catalog = buildPartialCatalog({
  manifolds: MANIFOLDS,
  boilerManifolds: BOILER_MANIFOLDS,
});

/**
 * @param {string} roomId
 * @param {string} roomName
 * @param {number} loopsCount
 * @returns {import('../src/types/shared-types.js').UnderfloorHeatingRoomReport}
 */
function ufhRoom(roomId, roomName, loopsCount) {
  return buildUfhRoom(roomId, roomName, loopsCount);
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
    building: buildBuildingInput({
      objectMeta: buildObjectMeta({ objectType: 'apartment', roomsCount: 2 }),
      rooms: [
        buildRoom({ id: 'r1', name: 'Кімната', areaM2: 12 }),
      ],
    }),
    underfloorHeating: buildUfhReport({
      distributionPreset: 'collector_mixing_valve',
      rooms: [ufhRoom('r1', 'Кімната', 5)],
      totalHeatFluxUpWatts: 1000,
      totalHeatFluxDownWatts: 100,
    }),
    radiators: { chosen: null, byRoom: [], warnings: [] },
    boiler: { requiredKw: 12, warnings: [] },
    hydraulics: { radiatorWiringSystemType: 'auto' },
  });
  assert.equal(report.ok, true);
  assert.equal(report.failureCode, undefined);
  assert.equal(report.underfloor.length, 1);
  const ufhFloor0 = assertAt(report.underfloor, 0, 'underfloor[0]');
  assert.equal(ufhFloor0.requiredOutlets, 5);
  assert.equal(ufhFloor0.units.length, 1);
  assert.equal(assertAt(ufhFloor0.units, 0, 'underfloor[0].units[0]').selected?.model, 'Ufh-5-FM');
  assert.equal(report.boilerManifold, null);
  assert.equal(report.radiator, null);
}

// 4) house + hydraulic_separator → boilerManifold
{
  const report = pickManifolds({
    catalog,
    building: buildBuildingInput({
      objectMeta: buildObjectMeta({ objectType: 'house', roomsCount: 2 }),
      rooms: [
        buildRoom({ id: 'r1', name: 'Зал', areaM2: 20 }),
        buildRoom({ id: 'r2', name: 'Спальня', areaM2: 15 }),
      ],
    }),
    underfloorHeating: buildUfhReport({
      distributionPreset: 'hydraulic_separator',
      rooms: [ufhRoom('r1', 'Зал', 4)],
      totalHeatFluxUpWatts: 2000,
      totalHeatFluxDownWatts: 200,
    }),
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
  assert.equal(report.ok, true);
  assert.equal(report.failureCode, undefined);
  assert.ok(report.boilerManifold);
  assert.equal(report.boilerManifold.requiredCircuits, 2);
  assert.equal(report.boilerManifold.requiredPowerKw, 24);
  assert.equal(report.boilerManifold.selected?.model, 'BM-3');
  assert.equal(assertAt(assertAt(report.underfloor, 0).units, 0).selected?.model, 'Ufh-5-FM');
}

// 5) radiator wiring = manifold
{
  const report = pickManifolds({
    catalog,
    building: buildBuildingInput({
      objectMeta: buildObjectMeta({ objectType: 'house', roomsCount: 3 }),
      rooms: [
        buildRoom({ id: 'a', name: 'A', areaM2: 10 }),
        buildRoom({ id: 'b', name: 'B', areaM2: 10 }),
        buildRoom({ id: 'c', name: 'C', areaM2: 10 }),
      ],
    }),
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
  assert.equal(report.ok, true);
  assert.ok(report.radiator);
  assert.equal(report.radiator.requiredOutlets, 3);
  assert.equal(report.radiator.selected?.model, 'Rad-3');
  assert.equal(report.underfloor.length, 0);
  assert.equal(report.boilerManifold, null);
}

// 6) порожній пул → warning, selected null
{
  const empty = buildPartialCatalog({});
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
    building: buildBuildingInput({
      objectMeta: buildObjectMeta({ objectType: 'house', floors: 2, roomsCount: 2 }),
      rooms: [
        buildRoom({ id: 'f1', name: '1п', floor: 1, areaM2: 15 }),
        buildRoom({ id: 'f2', name: '2п', floor: 2, topBoundary: 'roof', areaM2: 15 }),
      ],
    }),
    underfloorHeating: buildUfhReport({
      distributionPreset: 'collector_mixing_valve',
      rooms: [
        ufhRoom('f1', '1п', 3),
        ufhRoom('f2', '2п', 5),
      ],
      totalHeatFluxUpWatts: 2000,
      totalHeatFluxDownWatts: 200,
    }),
    radiators: { chosen: null, byRoom: [], warnings: [] },
    boiler: { requiredKw: 15, warnings: [] },
    hydraulics: {},
  });
  assert.equal(report.ok, true);
  assert.equal(report.underfloor.length, 2);
  const ufhFloor0Multi = assertAt(report.underfloor, 0, 'underfloor[0]');
  const ufhFloor1Multi = assertAt(report.underfloor, 1, 'underfloor[1]');
  assert.equal(ufhFloor0Multi.floor, 1);
  assert.equal(ufhFloor0Multi.requiredOutlets, 3);
  assert.equal(ufhFloor0Multi.units.length, 1);
  assert.equal(ufhFloor1Multi.floor, 2);
  assert.equal(ufhFloor1Multi.requiredOutlets, 5);
  assert.equal(assertAt(ufhFloor1Multi.units, 0).selected?.model, 'Ufh-5-FM');
}

// 8) 12 петель → 1 unit, без cascade warning
{
  const report = pickManifolds({
    catalog,
    building: buildBuildingInput({
      objectMeta: buildObjectMeta({ objectType: 'house', roomsCount: 1 }),
      rooms: [
        buildRoom({ id: 'r1', name: 'Зал', areaM2: 40 }),
      ],
    }),
    underfloorHeating: buildUfhReport({
      distributionPreset: 'collector_mixing_valve',
      rooms: [ufhRoom('r1', 'Зал', 12)],
      totalHeatFluxUpWatts: 3000,
      totalHeatFluxDownWatts: 300,
    }),
    radiators: { chosen: null, byRoom: [], warnings: [] },
    boiler: { requiredKw: 20, warnings: [] },
    hydraulics: {},
  });
  assert.equal(report.ok, true);
  const ufh12 = assertAt(report.underfloor, 0);
  assert.equal(ufh12.units.length, 1);
  assert.equal(assertAt(ufh12.units, 0).requiredOutlets, 12);
  assert.equal(assertAt(ufh12.units, 0).selected?.model, 'Ufh-12-FM');
  assert.ok(!report.warnings.some((w) => w.includes('Превышен лимит петель')));
}

// 9) 14 петель → каскад 7+7, warning, два SKU
{
  const report = pickManifolds({
    catalog,
    building: buildBuildingInput({
      objectMeta: buildObjectMeta({ objectType: 'house', roomsCount: 1 }),
      rooms: [
        buildRoom({ id: 'r1', name: 'Зал', areaM2: 50 }),
      ],
    }),
    underfloorHeating: buildUfhReport({
      distributionPreset: 'collector_mixing_valve',
      rooms: [ufhRoom('r1', 'Зал', 14)],
      totalHeatFluxUpWatts: 4000,
      totalHeatFluxDownWatts: 400,
    }),
    radiators: { chosen: null, byRoom: [], warnings: [] },
    boiler: { requiredKw: 24, warnings: [] },
    hydraulics: {},
  });
  assert.equal(report.ok, true);
  const floorPick = assertAt(report.underfloor, 0, 'underfloor[0] cascade 14');
  assert.equal(floorPick.requiredOutlets, 14);
  assert.equal(floorPick.units.length, 2);
  assert.equal(assertAt(floorPick.units, 0).requiredOutlets, 7);
  assert.equal(assertAt(floorPick.units, 1).requiredOutlets, 7);
  assert.equal(assertAt(floorPick.units, 0).selected?.model, 'Ufh-7-FM');
  assert.equal(assertAt(floorPick.units, 1).selected?.model, 'Ufh-7-FM');
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
    building: buildBuildingInput({
      objectMeta: buildObjectMeta({ objectType: 'house', roomsCount: 1 }),
      rooms: [
        buildRoom({ id: 'r1', name: 'Зал', areaM2: 80 }),
      ],
    }),
    underfloorHeating: buildUfhReport({
      distributionPreset: 'collector_mixing_valve',
      rooms: [ufhRoom('r1', 'Зал', 25)],
      totalHeatFluxUpWatts: 6000,
      totalHeatFluxDownWatts: 600,
    }),
    radiators: { chosen: null, byRoom: [], warnings: [] },
    boiler: { requiredKw: 30, warnings: [] },
    hydraulics: {},
  });
  assert.equal(report.ok, true);
  const units = assertAt(report.underfloor, 0).units;
  assert.equal(units.length, 3);
  assert.deepEqual(
    units.map((u) => u.requiredOutlets),
    [9, 8, 8],
  );
  assert.ok(report.warnings.some((w) => w.includes('на 3 коллектора') && w.includes('9+8+8')));
}

// 11) порожній каталог underfloor — штатний ok:true + selected null (не soft-fail)
{
  const empty = buildPartialCatalog({});
  const report = pickManifolds({
    catalog: empty,
    building: buildBuildingInput({
      objectMeta: buildObjectMeta({ objectType: 'apartment', roomsCount: 1 }),
      rooms: [
        buildRoom({ id: 'r1', name: 'Кімната', areaM2: 12 }),
      ],
    }),
    underfloorHeating: buildUfhReport({
      distributionPreset: 'collector_mixing_valve',
      rooms: [ufhRoom('r1', 'Кімната', 4)],
      totalHeatFluxUpWatts: 1000,
      totalHeatFluxDownWatts: 100,
    }),
    radiators: { chosen: null, byRoom: [], warnings: [] },
    boiler: { requiredKw: 12, warnings: [] },
    hydraulics: {},
  });
  assert.equal(report.ok, true);
  assert.equal(report.failureCode, undefined);
  assert.equal(report.underfloor.length, 1);
  assert.equal(assertAt(assertAt(report.underfloor, 0).units, 0).selected, null);
  assert.ok(report.warnings.some((w) => w.includes('нет коллекторов')));
}

// 12) soft-fail builders
{
  const fail = buildEmptyManifoldsFailure({
    failureCode: MANIFOLD_FAILURE_CODE_INTERNAL,
    message: 'Смета коллекторов пуста; расчёт унибоксов и гидравлики продолжается.',
    causeMessage: 'boom',
  });
  assert.equal(fail.ok, false);
  assert.equal(fail.failureCode, MANIFOLD_FAILURE_CODE_INTERNAL);
  assert.deepEqual(fail.underfloor, []);
  assert.equal(fail.radiator, null);
  assert.equal(fail.boilerManifold, null);
  assert.ok(fail.warnings.length >= 2);
  assert.ok(fail.warnings.some((w) => w.includes('MANIFOLD_INTERNAL')));
  assert.ok(fail.warnings.some((w) => w.includes('boom')));

  const ok = buildOkManifoldsReport({
    underfloor: [],
    radiator: null,
    boilerManifold: null,
    warnings: [],
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.failureCode, undefined);
}

// 13) pickManifoldsWithCore: throw → ok:false, без пробросу
// INTERNAL: у лог передається Error (stack); INPUT — лише payload без Error.
{
  /** @type {Array<{ msg: string, payload: unknown, rest: unknown[] }>} */
  const warnCalls = [];
  const origWarn = logger.warn;
  logger.warn = (msg, _meta, ...rest) => {
    const payload = rest[0];
    warnCalls.push({ msg: String(msg), payload, rest });
  };
  try {
    const report = pickManifoldsWithCore(() => {
      throw new Error('simulated manifold crash');
    }, {});
    assert.equal(report.ok, false);
    assert.equal(report.failureCode, MANIFOLD_FAILURE_CODE_INTERNAL);
    assert.deepEqual(report.underfloor, []);
    assert.equal(report.radiator, null);
    assert.equal(report.boilerManifold, null);
    assert.ok(report.warnings.some((w) => w.includes('MANIFOLD_INTERNAL')));
    assert.ok(report.warnings.some((w) => w.includes('simulated manifold crash')));

    const internalLog = warnCalls.find((c) => c.msg === 'matching.manifold.fail');
    assert.ok(internalLog, 'INTERNAL: matching.manifold.fail logged');
    assert.equal(
      /** @type {{ code?: string }} */ (internalLog.payload)?.code,
      MANIFOLD_FAILURE_CODE_INTERNAL,
    );
    assert.ok(
      internalLog.rest.some((a) => a instanceof Error),
      'INTERNAL: Error (stack) passed to logger.warn',
    );
  } finally {
    logger.warn = origWarn;
  }
}

// 14) INPUT_INVALID через err.code — лог без Error/stack
{
  /** @type {Array<{ msg: string, payload: unknown, rest: unknown[] }>} */
  const warnCalls = [];
  const origWarn = logger.warn;
  logger.warn = (msg, _meta, ...rest) => {
    warnCalls.push({ msg: String(msg), payload: rest[0], rest });
  };
  try {
    /** @type {Error & { code?: string }} */
    const err = new Error('bad floor map');
    err.code = MANIFOLD_FAILURE_CODE_INPUT;
    const report = pickManifoldsWithCore(() => {
      throw err;
    }, {});
    assert.equal(report.ok, false);
    assert.equal(report.failureCode, MANIFOLD_FAILURE_CODE_INPUT);
    assert.deepEqual(report.underfloor, []);

    const inputLog = warnCalls.find((c) => c.msg === 'matching.manifold.fail');
    assert.ok(inputLog, 'INPUT: matching.manifold.fail logged');
    assert.equal(
      /** @type {{ code?: string, message?: string | null }} */ (inputLog.payload)?.code,
      MANIFOLD_FAILURE_CODE_INPUT,
    );
    assert.equal(
      /** @type {{ message?: string | null }} */ (inputLog.payload)?.message,
      'bad floor map',
    );
    assert.equal(
      inputLog.rest.some((a) => a instanceof Error),
      false,
      'INPUT: Error/stack must not be passed to logger.warn',
    );
    assert.equal(inputLog.rest.length, 1, 'INPUT: only payload arg after meta');
  } finally {
    logger.warn = origWarn;
  }
}

console.log('verify:manifold-matching OK');
