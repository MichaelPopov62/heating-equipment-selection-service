/**
 * Назначение: verify агрегата emittersSummary и выбора панели под окно.
 * Описание: summarizeRadiatorEmitters; pickPanelSkuForRoom с фильтром ≥70% окна;
 * кейс r6-like (q≈788, окно 1850) — обе линии согласованы по длине панели.
 * Запуск: cd backend && npm run verify:radiator-emitters
 */
import { summarizeRadiatorEmitters } from '../src/matching/internal/summarizeRadiatorEmitters.js';
import {
  adjustOutputWatts,
  pickPanelSkuForRoom,
} from '../src/matching/radiatorSizingHelpers.js';
import { warmupReferenceCache, getReferenceBundle, toCalcRuntimeContext } from '../src/reference/public.js';
import { pickRadiatorsWithProposalLines } from '../src/matching/radiators.js';
import { assertDefined } from './fixtures/scriptAssert.js';
import {
  buildBoilerEquipmentProposal,
  buildHeatLossReport,
  buildHeatLossRoom,
  buildMinimalBoilerMatchingReport,
  buildObjectMeta,
  buildRoom,
} from './fixtures/verifyFixtures.js';

/** @param {boolean} ok @param {string} label */
function check(ok, label) {
  console.log(ok ? 'OK' : 'FAIL', '—', label);
  return ok;
}

async function main() {
  let ok = true;

  const summaryEmpty = summarizeRadiatorEmitters([]);
  ok =
    check(summaryEmpty.panelUnits === 0 && summaryEmpty.sectionalSections === 0, 'empty summary') &&
    ok;

  const summaryMixed = summarizeRadiatorEmitters([
    {
      roomId: 'a',
      roomName: 'A',
      heatLossWatts: 100,
      radiatorDesignWatts: 100,
      radiatorModel: 'Mirado',
      outputPerSectionWatts: 100,
      sections: 10,
      deliverableWatts: 1000,
      displayKind: 'sectional',
      priceBasis: 'section',
    },
    {
      roomId: 'b',
      roomName: 'B',
      heatLossWatts: 800,
      radiatorDesignWatts: 800,
      radiatorModel: '33K 600x1800',
      outputPerSectionWatts: 0,
      sections: null,
      deliverableWatts: 1948,
      displayKind: 'panel',
      priceBasis: 'panel',
      panelLengthMm: 1800,
    },
    {
      roomId: 'c',
      roomName: 'C',
      heatLossWatts: 50,
      radiatorDesignWatts: 0,
      radiatorModel: '—',
      outputPerSectionWatts: 0,
      sections: null,
      deliverableWatts: 0,
      displayKind: 'none',
    },
  ]);
  ok =
    check(
      summaryMixed.panelUnits === 1 &&
        summaryMixed.sectionalUnits === 1 &&
        summaryMixed.sectionalSections === 10 &&
        summaryMixed.totalDeliverableWatts === 2948 &&
        summaryMixed.roomsSkipped === 1,
      'mixed summary panels vs sections',
    ) && ok;

  await warmupReferenceCache();
  const bundle = await getReferenceBundle();
  const ctx = toCalcRuntimeContext(bundle);
  const panels = (ctx.catalog?.radiators ?? []).filter(
    /** @param {import('../src/catalog/types.js').RadiatorCatalogItemNormalized} r */
    (r) => r.priceBasis === 'panel',
  );

  const qRad = 788;
  const opening = 1850;
  const minLen = 0.7 * opening;

  const panelHigh = pickPanelSkuForRoom(qRad, panels, 50, 50, opening);
  const panelLow = pickPanelSkuForRoom(qRad, panels, 50, 30, opening);

  ok =
    check(
      panelHigh != null &&
        panelHigh.panelLengthMm >= minLen &&
        panelHigh.adjustedWatts >= qRad,
      `75/65 panel length ≥ ${Math.round(minLen)} мм (got ${panelHigh?.panelLengthMm})`,
    ) && ok;
  ok =
    check(
      panelLow != null &&
        panelLow.panelLengthMm >= minLen &&
        panelLow.adjustedWatts >= qRad,
      `55/45 panel length ≥ ${Math.round(minLen)} мм (got ${panelLow?.panelLengthMm})`,
    ) && ok;

  // Без фильтра окна короткая панель могла бы пройти на ΔT50 — проверяем регресс.
  const shortWithoutFilter = pickPanelSkuForRoom(qRad, panels, 50, 50, null);
  ok =
    check(
      shortWithoutFilter != null && shortWithoutFilter.panelLengthMm < minLen,
      'без фильтра окна выбирается более короткая панель (регресс-якорь)',
    ) && ok;

  const heatLoss = buildHeatLossReport({
    totalWatts: 788,
    rooms: [
      buildHeatLossRoom({
        id: 'r6',
        name: 'Комната 6',
        type: 'спальня',
        envelopeWatts: 606,
        designWatts: 788,
      }),
    ],
  });

  /** @type {import('../src/types/shared-types.js').BuildingInput} */
  const building = {
    objectMeta: buildObjectMeta({ objectType: 'apartment', ventilationReserveMode: 'natural' }),
    rooms: [
      buildRoom({
        id: 'r6',
        name: 'Комната 6',
        type: 'спальня',
        areaM2: 14,
        heightM: 2.75,
        roomExteriorLayout: 'corner',
      }),
    ],
    envelopeElements: [
      {
        kind: 'window',
        roomId: 'r6',
        construction: 'окно',
        areaM2: 3.5,
        openingWidthMm: 1850,
        openingHeightMm: 1900,
      },
    ],
    temps: { insideC: 20, outsideC: -23 },
  };

  const boilerStub = buildMinimalBoilerMatchingReport({
    heatLossKw: 0.8,
    requiredKw: 24,
    selected: null,
    proposalEconomy: buildBoilerEquipmentProposal({
      headline: 'eco',
      model: 'Baxi ECO Home 24 F',
    }),
    proposalEfficient: buildBoilerEquipmentProposal({
      headline: 'eff',
      model: 'Luna Duo-Tec E 33',
      unitMaxPowerKw: 28,
      totalNominalKw: 28,
    }),
  });

  const report = pickRadiatorsWithProposalLines({
    roomsHeatLoss: heatLoss,
    heatingSystem: {
      thermalRegimePreset: 'condensing_dt30_55_45',
      supplyC: 55,
      returnC: 45,
      insideC: 20,
      radiatorReferenceDeltaT: 50,
    },
    catalog: ctx.catalog,
    building,
    boiler: boilerStub,
    radiatorRules: ctx.appliances?.byKind?.radiator ?? null,
    recommendations: ctx.recommendations ?? null,
  });

  const ecoR6 = report.lineEconomy?.byRoom?.find((r) => r.roomId === 'r6');
  const effR6 = assertDefined(
    report.lineEfficient?.byRoom?.find((r) => r.roomId === 'r6'),
    'effR6',
  );

  ok =
    check(
      report.lineEconomy?.emittersSummary != null &&
        report.lineEfficient?.emittersSummary != null,
      'line emittersSummary present',
    ) && ok;

  ok =
    check(
      ecoR6 != null &&
        effR6.displayKind === ecoR6.displayKind &&
        ecoR6.displayKind !== 'none',
      `economy/efficient r6 same displayKind=${ecoR6?.displayKind} (models ${ecoR6?.radiatorModel} / ${effR6.radiatorModel})`,
    ) && ok;

  if (ecoR6?.displayKind === 'panel') {
    ok =
      check(
        ecoR6.outputPerSectionWatts === 0 &&
          (ecoR6.deliverableWatts ?? 0) > 0 &&
          (ecoR6.panelLengthMm ?? 0) >= minLen,
        'economy panel semantics (watts=0 per section, deliverable>0, L≥70%)',
      ) && ok;
  } else if (ecoR6?.displayKind === 'sectional') {
    ok =
      check(
        typeof ecoR6.sections === 'number' &&
          ecoR6.sections > 0 &&
          ecoR6.outputPerSectionWatts > 0 &&
          (ecoR6.deliverableWatts ?? 0) > 0 &&
          ecoR6.widthOk === true,
        `economy sectional under window (sections=${ecoR6?.sections}, widthOk=${ecoR6?.widthOk})`,
      ) && ok;
    const ecoSections = assertDefined(ecoR6.sections, 'ecoR6.sections');
    ok =
      check(
        typeof effR6.sections === 'number' &&
          effR6.sections >= ecoSections &&
          effR6.widthOk === true,
        `efficient sectional ≥ economy sections under same window (${effR6.sections} ≥ ${ecoSections})`,
      ) && ok;
  }

  ok =
    check(
      (report.lineEconomy?.totalSections ?? 0) ===
        (report.lineEconomy?.emittersSummary?.sectionalSections ?? -1),
      'totalSections === emittersSummary.sectionalSections (economy)',
    ) && ok;

  ok =
    check(
      Array.isArray(report.roomEmitterDiffs) &&
        report.roomEmitterDiffs.some((d) => d.roomId === 'r6'),
      'roomEmitterDiffs includes r6',
    ) && ok;

  const adj = adjustOutputWatts({ baseWatts: 100, baseDeltaT: 50, targetDeltaT: 30 });
  ok = check(adj > 0 && adj < 100, 'adjustOutputWatts sanity') && ok;

  if (!ok) {
    console.error('\nverify:radiator-emitters FAILED');
    process.exit(1);
  }
  console.log('\nverify:radiator-emitters OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
