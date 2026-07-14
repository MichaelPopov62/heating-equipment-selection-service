/**
 * Назначение: verify Two-Pass emitter kind (единый тип на объект).
 * Описание: majority без flip; hard lock; bottom+sectional; одинаковый kind на линиях.
 * Запуск: cd backend && npm run verify:radiator-emitter-kind
 */
import {
  DEFAULT_RADIATOR_EMITTER_PREFERENCE,
  normalizeRadiatorEmitterPreference,
} from '../../shared/radiatorEmitterPreference.js';
import { decideObjectEmitterKind } from '../src/matching/internal/decideObjectEmitterKind.js';
import { exploreRoomEmitterKindVote } from '../src/matching/internal/exploreRoomEmitterKind.js';
import { pickRadiators } from '../src/matching/internal/pickRadiatorsCore.js';
import { pickRadiatorsWithProposalLines } from '../src/matching/radiators.js';
import { normalizeHeatingSystemThermalRegime } from '../src/logic/heatingThermalRegimes.js';
import {
  warmupReferenceCache,
  getReferenceBundle,
  toCalcRuntimeContext,
} from '../src/reference/public.js';
import {
  buildMinimalBoilerMatchingReport,
  buildObjectMeta,
  buildRoom,
} from './fixtures/verifyFixtures.js';
import { assertDefined } from './fixtures/scriptAssert.js';

/** @param {boolean} ok @param {string} label */
function check(ok, label) {
  console.log(ok ? 'OK' : 'FAIL', '—', label);
  return ok;
}

/**
 * @param {number} n
 * @param {number} watts
 * @returns {import('../src/types/shared-types.js').HeatLossReport}
 */
function makeRoomsHeatLoss(n, watts) {
  /** @type {import('../src/types/shared-types.js').HeatLossRoomReport[]} */
  const rooms = [];
  for (let i = 1; i <= n; i += 1) {
    rooms.push({
      id: `r${i}`,
      name: `Комната ${i}`,
      type: 'гостиная',
      areaM2: 15,
      heightM: 2.7,
      volumeM3: 40.5,
      envelopeWatts: watts,
      designWatts: watts,
      elements: [],
    });
  }
  return {
    totalWatts: watts * n,
    rooms,
    ventilation: { watts: 0, method: null },
  };
}

async function main() {
  let ok = true;

  ok =
    check(
      normalizeRadiatorEmitterPreference(undefined) === 'auto',
      'undefined preference → auto',
    ) && ok;
  ok =
    check(
      normalizeRadiatorEmitterPreference('panel') === 'panel',
      'panel preference preserved',
    ) && ok;
  ok =
    check(
      normalizeRadiatorEmitterPreference('x') === DEFAULT_RADIATOR_EMITTER_PREFERENCE,
      'junk → auto',
    ) && ok;

  /** @type {import('../src/types/shared-types.js').CalcRequestBody} */
  const body = {
    building: {
      temps: { insideC: 20, outsideC: -5 },
      objectMeta: buildObjectMeta({ objectType: 'house', roomsCount: 1 }),
      rooms: [],
      envelopeElements: [],
    },
    heatingSystem: { thermalRegimePreset: 'traditional_dt50_75_65' },
  };
  normalizeHeatingSystemThermalRegime(body);
  ok =
    check(
      body.heatingSystem?.radiatorEmitterPreference === 'auto',
      'thermal normalize sets radiatorEmitterPreference=auto',
    ) && ok;

  const majority = decideObjectEmitterKind({
    preference: 'auto',
    votes: [
      { roomId: 'r1', preferredKind: 'sectional', reason: 'a' },
      { roomId: 'r2', preferredKind: 'sectional', reason: 'b' },
      { roomId: 'r3', preferredKind: 'sectional', reason: 'c' },
      { roomId: 'r4', preferredKind: 'sectional', reason: 'd' },
      { roomId: 'r5', preferredKind: 'panel', reason: 'gate' },
    ],
  });
  ok =
    check(
      majority.resolvedEmitterKind === 'sectional'
        && majority.decisionSource === 'majority'
        && majority.emitterKindVotes.sectional === 4
        && majority.emitterKindVotes.panel === 1,
      'majority 4 sectional vs 1 panel → sectional',
    ) && ok;

  const locked = decideObjectEmitterKind({
    preference: 'panel',
    votes: majority.emitterKindVotes
      ? [
          { roomId: 'r1', preferredKind: 'sectional', reason: 'ignored' },
        ]
      : [],
  });
  ok = check(locked.resolvedEmitterKind === 'panel', 'preference panel locks') && ok;

  await warmupReferenceCache();
  const ctx = toCalcRuntimeContext(await getReferenceBundle());
  const catalog = ctx.catalog;
  const radiatorRules = ctx.appliances?.byKind?.radiator ?? null;
  const recommendations = ctx.recommendations;

  ok =
    check(
      radiatorRules?.emitterKind?.maxUnitsPerRoom >= 2,
      'appliances.radiator.emitterKind loaded',
    ) && ok;

  const roomsHeatLoss = makeRoomsHeatLoss(5, 900);
  const heatLossRooms = assertDefined(roomsHeatLoss.rooms, 'roomsHeatLoss.rooms');
  /** @type {import('../src/types/shared-types.js').BuildingInput} */
  const building = {
    temps: { insideC: 20, outsideC: -5 },
    objectMeta: buildObjectMeta({ objectType: 'house', roomsCount: 5 }),
    rooms: heatLossRooms.map((r) => buildRoom({
      id: r.id,
      name: r.name,
      type: 'гостиная',
      areaM2: 15,
      heightM: 2.7,
    })),
    envelopeElements: /** @type {import('../src/types/shared-types.js').EnvelopeElementInput[]} */ ([
      {
        kind: 'window',
        roomId: 'r5',
        construction: 'окно',
        areaM2: 3,
        openingWidthMm: 2200,
        openingHeightMm: 1400,
        orientation: 'S',
        presetId: 'window_double',
      },
      ...[1, 2, 3, 4].map((i) => ({
        kind: 'window',
        roomId: `r${i}`,
        construction: 'окно',
        areaM2: 1.5,
        openingWidthMm: 900,
        openingHeightMm: 1400,
        orientation: 'S',
        presetId: 'window_double',
      })),
    ]),
  };

  const heatingSystem = {
    supplyC: 75,
    returnC: 65,
    insideC: 20,
    radiatorReferenceDeltaT: /** @type {70} */ (70),
    radiatorConnection: /** @type {'side'} */ ('side'),
    radiatorEmitterPreference: /** @type {'auto'} */ ('auto'),
    thermalRegimePreset: /** @type {'traditional_dt50_75_65'} */ (
      'traditional_dt50_75_65'
    ),
  };

  // Pass 1: убеждаемся, что у r5 может быть panel-голос при широком окне
  const sectionalPool = (catalog?.radiators ?? []).filter(
    /** @param {import('../src/catalog/types.js').RadiatorCatalogItemNormalized} r */
    (r) => r.priceBasis !== 'panel',
  );
  const panelPool = (catalog?.radiators ?? []).filter(
    /** @param {import('../src/catalog/types.js').RadiatorCatalogItemNormalized} r */
    (r) => r.priceBasis === 'panel',
  );
  const voteWide = exploreRoomEmitterKindVote({
    qRad: 900,
    sectionalPool,
    panelPoolFiltered: panelPool,
    baseDeltaT: 70,
    targetDeltaT: 50,
    radiatorConnection: 'side',
    windowOpeningWidthMm: 2200,
    maxSectionsBeforeMultiUnit: 24,
    maxSectionsHeuristic: 80,
    sectionalCandidatesPerRoom: 16,
    ventilationReserveFactor: 1.3,
  });
  ok = check(voteWide != null, 'explore vote for wide window exists') && ok;

  const primary = pickRadiators({
    roomsHeatLoss,
    heatingSystem,
    catalog,
    building,
    radiatorRules,
    recommendations,
  });

  const kinds = new Set(
    (primary.byRoom ?? [])
      .filter((r) => r.displayKind === 'sectional' || r.displayKind === 'panel')
      .map((r) => r.displayKind),
  );
  ok =
    check(
      kinds.size === 1 && primary.resolvedEmitterKind != null,
      `single kind on object: ${primary.resolvedEmitterKind} (rooms=${[...kinds]})`,
    ) && ok;

  const lockedSectional = pickRadiators({
    roomsHeatLoss,
    heatingSystem: {
      ...heatingSystem,
      radiatorEmitterPreference: 'sectional',
      radiatorConnection: 'bottom',
    },
    catalog,
    building,
    radiatorRules,
    recommendations,
  });
  const kindsBottom = new Set(
    (lockedSectional.byRoom ?? [])
      .filter((r) => r.displayKind === 'sectional' || r.displayKind === 'panel')
      .map((r) => r.displayKind),
  );
  ok =
    check(
      lockedSectional.resolvedEmitterKind === 'sectional'
        && (kindsBottom.size === 0 || (kindsBottom.size === 1 && kindsBottom.has('sectional'))),
      'bottom + sectional lock → all sectional',
    ) && ok;

  const lockedPanel = pickRadiators({
    roomsHeatLoss,
    heatingSystem: { ...heatingSystem, radiatorEmitterPreference: 'panel' },
    catalog,
    building,
    radiatorRules,
    recommendations,
  });
  ok =
    check(
      lockedPanel.resolvedEmitterKind === 'panel',
      'hard lock panel',
    ) && ok;
  const panelKinds = new Set(
    (lockedPanel.byRoom ?? [])
      .filter((r) => r.displayKind === 'sectional' || r.displayKind === 'panel')
      .map((r) => r.displayKind),
  );
  ok =
    check(
      panelKinds.size === 0 || (panelKinds.size === 1 && panelKinds.has('panel')),
      'panel lock → no sectional rooms',
    ) && ok;

  // Линии proposal с единым kind
  const fakeBoiler = buildMinimalBoilerMatchingReport({
    proposalEconomy: {
      model: 'Eco',
      kind: 'single',
      headline: 'Eco',
      unitsCount: 1,
      unitMaxPowerKw: 24,
      totalNominalKw: 24,
      requiredKw: 24,
      powerRequirementBreakdown: { heatingLoadKw: 9.2, hotWaterPowerKw: 0 },
      nominalReservePercent: 100,
      advantages: [],
      notes: [],
    },
    proposalEfficient: {
      model: 'Eff',
      kind: 'single',
      headline: 'Eff',
      unitsCount: 1,
      unitMaxPowerKw: 24,
      totalNominalKw: 24,
      requiredKw: 24,
      powerRequirementBreakdown: { heatingLoadKw: 9.2, hotWaterPowerKw: 0 },
      nominalReservePercent: 100,
      advantages: [],
      notes: [],
    },
  });

  const withLines = pickRadiatorsWithProposalLines({
    roomsHeatLoss,
    heatingSystem,
    catalog,
    building,
    boiler: fakeBoiler,
    radiatorRules,
    recommendations,
  });

  ok =
    check(
      withLines.resolvedEmitterKind != null
        && withLines.lineEconomy?.resolvedEmitterKind === withLines.resolvedEmitterKind
        && withLines.lineEfficient?.resolvedEmitterKind === withLines.resolvedEmitterKind,
      'economy/efficient same resolvedEmitterKind as primary',
    ) && ok;

  const ecoKinds = new Set(
    (withLines.lineEconomy?.byRoom ?? [])
      .filter((r) => r.displayKind === 'sectional' || r.displayKind === 'panel')
      .map((r) => r.displayKind),
  );
  const effKinds = new Set(
    (withLines.lineEfficient?.byRoom ?? [])
      .filter((r) => r.displayKind === 'sectional' || r.displayKind === 'panel')
      .map((r) => r.displayKind),
  );
  ok =
    check(
      (ecoKinds.size <= 1 && effKinds.size <= 1)
        && (ecoKinds.size === 0 || effKinds.size === 0 || [...ecoKinds][0] === [...effKinds][0]),
      'economy/efficient byRoom same displayKind family',
    ) && ok;

  // Multi-unit: высокая нагрузка + sectional lock
  const heavy = makeRoomsHeatLoss(1, 8000);
  /** @type {import('../src/types/shared-types.js').BuildingInput} */
  const heavyBuilding = {
    temps: { insideC: 20, outsideC: -5 },
    objectMeta: buildObjectMeta({ objectType: 'house', roomsCount: 1 }),
    rooms: [
      buildRoom({
        id: 'r1',
        name: 'Зал',
        type: 'гостиная',
        areaM2: 40,
        heightM: 2.7,
      }),
    ],
    envelopeElements: [
      {
        kind: 'window',
        roomId: 'r1',
        construction: 'окно',
        areaM2: 4,
        openingWidthMm: 2400,
        openingHeightMm: 1500,
        orientation: 'S',
        presetId: 'window_double',
      },
    ],
  };
  const multi = pickRadiators({
    roomsHeatLoss: heavy,
    heatingSystem: { ...heatingSystem, radiatorEmitterPreference: 'sectional' },
    catalog,
    building: heavyBuilding,
    radiatorRules,
    recommendations,
  });
  const multiRow = multi.byRoom?.[0];
  ok =
    check(
      multiRow != null
        && (multiRow.unitsCount ?? 1) >= 1
        && multiRow.displayKind === 'sectional',
      `escalation sectional unitsCount=${multiRow?.unitsCount ?? '?'}`,
    ) && ok;

  if (!ok) {
    console.error('\nverify:radiator-emitter-kind FAILED');
    process.exit(1);
  }
  console.log('\nverify:radiator-emitter-kind OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
