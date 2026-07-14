/**
 * Назначение: verify нормализации и matching по radiatorConnection.
 * Описание: default side; bottom → note + фильтр VKP; shared normalize.
 * Запуск: cd backend && npm run verify:radiator-connection
 */
import {
  DEFAULT_RADIATOR_CONNECTION,
  normalizeRadiatorConnection,
  radiatorConnectionLabel,
} from '../../shared/radiatorConnection.js';
import { normalizeHeatingSystemThermalRegime } from '../src/logic/heatingThermalRegimes.js';
import { buildRadiatorConnectionSelectionNotes } from '../src/matching/internal/radiatorConnectionNotes.js';
import { filterPanelsByConnection } from '../src/matching/radiatorSizingHelpers.js';
import { warmupReferenceCache, getReferenceBundle, toCalcRuntimeContext } from '../src/reference/public.js';
import { assertAt } from './fixtures/scriptAssert.js';
import { buildObjectMeta } from './fixtures/verifyFixtures.js';

/** @param {boolean} ok @param {string} label */
function check(ok, label) {
  console.log(ok ? 'OK' : 'FAIL', '—', label);
  return ok;
}

async function main() {
  let ok = true;

  ok = check(normalizeRadiatorConnection(undefined) === 'side', 'undefined → side') && ok;
  ok = check(normalizeRadiatorConnection('bottom') === 'bottom', 'bottom preserved') && ok;
  ok = check(normalizeRadiatorConnection('x') === DEFAULT_RADIATOR_CONNECTION, 'junk → side') && ok;
  ok = check(radiatorConnectionLabel('bottom') === 'нижняя', 'label bottom') && ok;

  /** @type {import('../src/types/shared-types.js').CalcRequestBody} */
  const body = {
    building: {
      temps: { insideC: 20, outsideC: -5 },
      objectMeta: buildObjectMeta({ objectType: 'apartment', roomsCount: 1 }),
      rooms: [],
      envelopeElements: [],
    },
    heatingSystem: {
      thermalRegimePreset: 'traditional_dt50_75_65',
    },
  };
  normalizeHeatingSystemThermalRegime(body);
  ok =
    check(
      body.heatingSystem?.radiatorConnection === 'side',
      'thermal normalize sets radiatorConnection=side',
    ) && ok;

  const notesBottom = buildRadiatorConnectionSelectionNotes('bottom');
  ok = check(notesBottom.length === 1 && /нижняя/i.test(assertAt(notesBottom, 0, 'notesBottom[0]')), 'notes bottom') && ok;
  ok = check(buildRadiatorConnectionSelectionNotes(null).length === 0, 'notes empty if unset') && ok;

  await warmupReferenceCache();
  const ctx = toCalcRuntimeContext(await getReferenceBundle());
  const panels = (ctx.catalog?.radiators ?? []).filter(
    /** @param {import('../src/catalog/types.js').RadiatorCatalogItemNormalized} r */
    (r) => r.priceBasis === 'panel',
  );
  const sidePool = filterPanelsByConnection(panels, 'side');
  const bottomPool = filterPanelsByConnection(panels, 'bottom');
  ok = check(sidePool.length > 0, `side panel pool ${sidePool.length}`) && ok;
  ok = check(bottomPool.length > 0, `bottom panel pool ${bottomPool.length}`) && ok;
  ok = check(sidePool.length !== bottomPool.length || panels.length > 0, 'pools differ or catalog thin') && ok;

  if (!ok) {
    console.error('\nverify:radiator-connection FAILED');
    process.exit(1);
  }
  console.log('\nverify:radiator-connection OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
