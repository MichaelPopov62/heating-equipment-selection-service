/**
 * Назначение: проверка HTML/PDF генератора сметы.
 * Запуск: cd backend && npm run verify:project-pdf
 */

import { buildEstimatePdfHtml } from '../src/projects/buildEstimatePdfHtml.js';
import { buildShareSnapshot } from '../src/projects/buildShareSnapshot.js';
import { buildEstimatePdfFilename } from '../src/projects/pdfFilename.js';
import { parseIncludeTechnicalQuery } from '../src/projects/parseIncludeTechnicalQuery.js';
import { renderPdfFromHtml } from '../src/projects/renderPdfFromHtml.js';

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

tally(logCheck(parseIncludeTechnicalQuery('1') === true, 'includeTechnical=1'));
tally(logCheck(parseIncludeTechnicalQuery('true') === true, 'includeTechnical=true'));
tally(logCheck(parseIncludeTechnicalQuery('0') === false, 'includeTechnical=0'));
tally(
  logCheck(
    buildEstimatePdfFilename({ clientName: 'Иван / Тест', label: 'M-1' }) ===
      'Смета_Иван_Тест_M-1.pdf',
    'filename sanitization',
  ),
);

/** @type {Record<string, unknown>} */
const fakeReport = {
  commercial: {
    schemaVersion: 1,
    currency: 'UAH',
    lines: [
      {
        kind: 'equipment',
        equipmentTypeLabel: 'Котёл',
        brand: 'Baxi',
        model: 'ECO Home 24',
        qty: 1,
        qtyUnit: 'pcs',
        unitPriceUah: 30000,
        lineTotalUah: 30000,
        categoryId: 'boiler',
      },
    ],
    totals: {
      equipmentQtyPcs: 1,
      equipmentTotalUah: 30000,
      laborTotalUah: 12000,
      consumablesTotalUah: 4500,
      grandTotalUah: 46500,
    },
    rates: { laborPercentOfEquipment: 0.4, consumablesPercentOfEquipment: 0.15 },
  },
  matching: {
    boiler: {
      requiredKw: 24,
      proposal: { model: 'ECO Home 24', brand: 'Baxi', totalNominalKw: 24, price: 30000 },
      proposalEconomy: { model: 'Eco Four 24', brand: 'Baxi', totalNominalKw: 24, price: 25000 },
      proposalEfficient: {
        model: 'Luna Duo-Tec E 33',
        brand: 'Baxi',
        totalNominalKw: 33,
        price: 45000,
      },
    },
  },
  calculations: {
    heatLoss: { totalWatts: 12000, byRoom: [{ roomName: 'Зал', totalWatts: 5000 }] },
    hotWater: { hotWaterPowerKw: 8, peakFlowLps: 0.2 },
  },
  meta: { generatedAt: '2026-01-01T00:00:00.000Z', catalogSource: 'file' },
  input: { building: { objectMeta: { objectType: 'house' } } },
  warnings: ['demo warning'],
};

const snapshot = buildShareSnapshot({
  clientName: 'Тест Клиент',
  label: 'M-1',
  report: fakeReport,
});

const html = buildEstimatePdfHtml(snapshot, { includeTechnical: false });
tally(logCheck(html.includes('HeatCalc Pro'), 'HTML бренд'));
tally(logCheck(html.includes('Финансовый итог'), 'HTML заголовок'));
tally(logCheck(html.includes('ECO Home 24'), 'HTML основная позиция'));
tally(logCheck(html.includes('Экономичный'), 'HTML карточка Экономичный'));
tally(logCheck(html.includes('Эффективный'), 'HTML карточка Эффективный'));
tally(logCheck(html.includes('46') || html.includes('46500'), 'HTML итог'));
tally(logCheck(!html.includes('Технический расчёт'), 'без technical по умолчанию'));

const htmlTech = buildEstimatePdfHtml(snapshot, { includeTechnical: true });
tally(logCheck(htmlTech.includes('Технический расчёт'), 'с technical'));
tally(logCheck(htmlTech.includes('Теплопотери'), 'technical теплопотери'));

let threwCommercial = false;
try {
  buildEstimatePdfHtml({ clientName: 'x', publishedAt: new Date().toISOString(), schemaVersion: 1 });
} catch (e) {
  threwCommercial = /** @type {{ code?: string }} */ (e).code === 'PDF_COMMERCIAL_REQUIRED';
}
tally(logCheck(threwCommercial, 'без commercial → PDF_COMMERCIAL_REQUIRED'));

let pdfSkipped = false;
try {
  const buf = await renderPdfFromHtml(html);
  const pdfOk =
    Buffer.isBuffer(buf) &&
    buf.byteLength > 500 &&
    buf.subarray(0, 4).toString('utf8') === '%PDF';
  tally(logCheck(pdfOk, `PDF render (%PDF, ${buf.byteLength} bytes)`));
} catch (e) {
  const code = /** @type {{ code?: string }} */ (e).code;
  if (code === 'PDF_BROWSER_MISSING') {
    pdfSkipped = true;
    console.log('SKIP — PDF render (нет Chromium; задайте PDF_BROWSER_EXECUTABLE или Chrome)');
  } else {
    console.error(e);
    tally(logCheck(false, `PDF render error: ${code ?? 'unknown'}`));
  }
}

if (pdfSkipped && process.env.PDF_REQUIRE_BROWSER === '1') {
  tally(logCheck(false, 'PDF_REQUIRE_BROWSER=1 но браузер не найден'));
}

if (failed > 0) {
  console.error(`\nverify:project-pdf FAILED (${failed})`);
  process.exit(1);
}

console.log('\nverify:project-pdf OK');
