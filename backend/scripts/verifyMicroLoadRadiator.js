/**
 * Назначение: smoke-тест Ф5 «Тамбур» — микронагрузка на радиатор.
 * Описание: resolveMicroLoadRadiatorStrategy + pickRadiators с минимальным прибором / skip.
 */

import assert from 'node:assert/strict';
import { resolveMicroLoadRadiatorStrategy } from '../src/matching/internal/resolveMicroLoadRadiatorStrategy.js';
import { pickRadiators } from '../src/matching/internal/pickRadiatorsCore.js';
import { warmupReferenceCache, getReferenceBundle, toCalcRuntimeContext } from '../src/reference/public.js';

/** @type {import('../src/dhw/types').RadiatorApplianceRules['microLoad']} */
const MICRO_LOAD_RULES = {
  minDesignWattsThreshold: 150,
  entryRoomTypes: ['прихожая', 'коридор', 'тамбур'],
};

const entryCorridor = {
  id: 'r-entry',
  name: 'Коридор',
  type: 'коридор',
  areaM2: 4,
  heightM: 2.7,
  envelopeWatts: 80,
  designWatts: 80,
  elements: [],
};

const internalTech = {
  id: 'r-tech',
  name: 'Кладовая',
  type: 'тех',
  areaM2: 3,
  heightM: 2.5,
  envelopeWatts: 60,
  designWatts: 60,
  elements: [],
};

const entryStrategy = resolveMicroLoadRadiatorStrategy({
  rules: MICRO_LOAD_RULES,
  room: entryCorridor,
  building: {
    rooms: [{ id: 'r-entry', roomExteriorLayout: 'internal' }],
    envelopeElements: [],
  },
  qRad: 80,
});
assert.equal(entryStrategy.action, 'minimum_viable', 'коридор → minimum_viable');

const internalStrategy = resolveMicroLoadRadiatorStrategy({
  rules: MICRO_LOAD_RULES,
  room: internalTech,
  building: {
    rooms: [{ id: 'r-tech', roomExteriorLayout: 'internal' }],
    envelopeElements: [],
  },
  qRad: 60,
});
assert.equal(internalStrategy.action, 'skip', 'внутреннее тех → skip');

const facadeStrategy = resolveMicroLoadRadiatorStrategy({
  rules: MICRO_LOAD_RULES,
  room: { ...internalTech, id: 'r-fac', type: 'спальня' },
  building: {
    rooms: [{ id: 'r-fac', roomExteriorLayout: 'facade' }],
    envelopeElements: [],
  },
  qRad: 100,
});
assert.equal(facadeStrategy.action, 'minimum_viable', 'фасад при q<150 → minimum_viable');

await warmupReferenceCache();
const ctx = toCalcRuntimeContext(await getReferenceBundle());
const radiatorRules = ctx.appliances.byKind.radiator;

const report = pickRadiators({
  roomsHeatLoss: { rooms: [entryCorridor, internalTech], totalWatts: 140 },
  heatingSystem: {
    supplyC: 75,
    returnC: 65,
    insideC: 20,
    radiatorReferenceDeltaT: 70,
  },
  catalog: ctx.catalog,
  building: {
    objectMeta: { objectType: 'apartment', ventilationReserveMode: 'natural' },
    rooms: [
      { id: 'r-entry', type: 'коридор', roomExteriorLayout: 'internal' },
      { id: 'r-tech', type: 'тех', roomExteriorLayout: 'internal' },
    ],
    envelopeElements: [],
  },
  radiatorRules,
  recommendations: ctx.recommendations,
});

const entryRow = report.byRoom.find((r) => r.roomId === 'r-entry');
const techRow = report.byRoom.find((r) => r.roomId === 'r-tech');

assert.ok(entryRow, 'entry row');
assert.ok(entryRow.sections != null && entryRow.sections >= 1, 'entry: минимум 1 секция');
assert.ok((entryRow.radiatorDesignWatts ?? 0) >= 150, 'entry: мощность для гидравлики ≥ порога');

assert.ok(techRow, 'tech row');
assert.equal(techRow.radiatorDesignWatts, 0, 'tech: без радиатора');
assert.equal(techRow.sections, null, 'tech: sections null');

assert.ok(
  (report.resolvedRecommendations ?? []).some((r) => r.code === 'REC_RADIATOR_ENTRY_ZONE_MINIMUM'),
  'REC_RADIATOR_ENTRY_ZONE_MINIMUM',
);
assert.ok(
  (report.resolvedRecommendations ?? []).some((r) => r.code === 'REC_RADIATOR_MICRO_LOAD_SKIP'),
  'REC_RADIATOR_MICRO_LOAD_SKIP',
);

console.log('OK — verifyMicroLoadRadiator (Ф5 Тамбур)');
