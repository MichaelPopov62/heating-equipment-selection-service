/**
 * Назначение: проверка генерации shareToken и whitelist-снимка публичной ссылки.
 * Запуск: cd backend && npm run verify:project-share
 */
import { generateShareToken, normalizeShareTokenParam } from '../src/projects/shareToken.js';
import { buildShareSnapshot } from '../src/projects/buildShareSnapshot.js';
import { serializePublicShare, serializeProjectShareMeta } from '../src/projects/serializeShare.js';

/** @param {boolean} ok @param {string} label */
function logCheck(ok, label) {
  console.log(ok ? 'OK' : 'FAIL', '—', label);
  return ok;
}

let failed = 0;

/** @param {boolean} ok */
function tally(ok) {
  if (!ok) failed += 1;
}

const token = generateShareToken();
tally(logCheck(typeof token === 'string' && token.length >= 24, 'generateShareToken длина'));
tally(logCheck(normalizeShareTokenParam(token) === token, 'normalizeShareTokenParam ok'));
tally(logCheck(normalizeShareTokenParam('short') === null, 'normalize отклоняет короткий'));
tally(logCheck(normalizeShareTokenParam('bad token!!') === null, 'normalize отклоняет мусор'));

const token2 = generateShareToken();
tally(logCheck(token !== token2, 'токены уникальны'));

/** @type {Record<string, unknown>} */
const fakeReport = {
  commercial: {
    schemaVersion: 1,
    currency: 'UAH',
    lines: [],
    totals: {
      equipmentQtyPcs: 0,
      equipmentTotalUah: 0,
      laborTotalUah: 0,
      consumablesTotalUah: 0,
      grandTotalUah: 0,
    },
    rates: { laborPercentOfEquipment: 0.2, consumablesPercentOfEquipment: 0.05 },
  },
  matching: {
    boiler: { requiredKw: 24 },
    radiators: { byRoom: [] },
  },
  calculations: {
    heatLoss: { totalWatts: 10000 },
    hotWater: { hotWaterPowerKw: 5 },
  },
  meta: { generatedAt: '2026-01-01T00:00:00.000Z', catalogSource: 'file' },
  temps: { insideC: 20, outsideC: -5 },
  input: {
    building: { objectMeta: { objectType: 'house' } },
  },
  warnings: ['w1', 42, 'w2'],
};

const snapshot = buildShareSnapshot({
  clientName: 'Тест',
  label: 'Дом',
  report: fakeReport,
});

tally(logCheck(snapshot.schemaVersion === 1, 'snapshot schemaVersion'));
tally(logCheck(snapshot.clientName === 'Тест', 'snapshot clientName'));
tally(logCheck(snapshot.objectType === 'house', 'snapshot objectType'));
tally(logCheck(snapshot.commercial === fakeReport.commercial, 'snapshot commercial'));
tally(
  logCheck(
    snapshot.matching != null &&
      /** @type {Record<string, unknown>} */ (snapshot.matching).boiler != null,
    'snapshot matching.boiler',
  ),
);
tally(
  logCheck(
    Array.isArray(snapshot.warnings) &&
      snapshot.warnings.length === 2 &&
      snapshot.warnings[0] === 'w1',
    'snapshot warnings только строки',
  ),
);

let threw = false;
try {
  buildShareSnapshot({ clientName: 'x', report: { matching: {} } });
} catch (e) {
  threw = /** @type {{ code?: string }} */ (e).code === 'SHARE_COMMERCIAL_REQUIRED';
}
tally(logCheck(threw, 'без commercial → SHARE_COMMERCIAL_REQUIRED'));

const pub = serializePublicShare(snapshot, token);
tally(logCheck(pub.shareToken === token, 'public shareToken'));
tally(logCheck(pub.commercial != null, 'public commercial'));
tally(logCheck(!('ownerId' in pub) && !('survey' in pub), 'public без ownerId/survey'));

const meta = serializeProjectShareMeta({
  shareToken: token,
  sharePublishedAt: new Date('2026-01-02T00:00:00.000Z'),
});
tally(logCheck(meta != null && meta.publicPath === `/s/${token}`, 'owner publicPath'));
tally(logCheck(serializeProjectShareMeta({}) === null, 'без токена meta null'));

if (failed > 0) {
  console.error(`\nverify:project-share — ${failed} проверок провалено`);
  process.exit(1);
}

console.log('\nverify:project-share — все проверки пройдены');
