/**
 * Назначение: HTML-документ финансовой сметы для серверного PDF.
 * Описание: таблица commercial + карточки proposalEconomy / proposalEfficient; не подменяет grandTotal.
 */

import { isPlainObject } from '../utils/isPlainObject.js';
import { escapeHtml } from './pdfHtmlEscape.js';
import { buildTechnicalPdfHtml } from './buildTechnicalPdfHtml.js';

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
function asObject(value) {
  return isPlainObject(value) ? value : null;
}

/**
 * @param {unknown} n
 * @returns {string}
 */
function money(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `${Math.round(n).toLocaleString('uk-UA')} ₴`;
}

/**
 * @param {unknown} unit
 * @returns {string}
 */
function qtyUnitLabel(unit) {
  switch (unit) {
    case 'pcs':
      return 'шт';
    case 'm':
      return 'м';
    case 'section':
      return 'сек.';
    case 'lot':
      return 'компл.';
    default:
      return '';
  }
}

/**
 * @param {Record<string, unknown> | null} proposal
 * @returns {{ model: string, brand: string, totalNominalKw: number | null, price: number | null, unavailableReason: string | null } | null}
 */
function readProposalCard(proposal) {
  if (!proposal) return null;
  if (typeof proposal.unavailableReason === 'string' && proposal.unavailableReason.trim()) {
    return {
      model: '',
      brand: '',
      totalNominalKw: null,
      price: null,
      unavailableReason: proposal.unavailableReason.trim(),
    };
  }
  const model = typeof proposal.model === 'string' ? proposal.model : '';
  const brand = typeof proposal.brand === 'string' ? proposal.brand : '';
  const selected = asObject(proposal.selected);
  const fromSelectedModel =
    selected && typeof selected.model === 'string' ? selected.model : '';
  const resolvedModel = model || fromSelectedModel;
  if (!resolvedModel && typeof proposal.requiredKw !== 'number') {
    return null;
  }
  const totalNominalKw =
    typeof proposal.totalNominalKw === 'number'
      ? proposal.totalNominalKw
      : typeof proposal.nominalKw === 'number'
        ? proposal.nominalKw
        : null;
  const price =
    typeof proposal.price === 'number'
      ? proposal.price
      : selected && typeof selected.price === 'number'
        ? selected.price
        : null;
  return {
    model: resolvedModel || '—',
    brand,
    totalNominalKw,
    price,
    unavailableReason: null,
  };
}

/**
 * @param {string} title
 * @param {ReturnType<typeof readProposalCard>} card
 * @returns {string}
 */
function proposalCardHtml(title, card) {
  if (!card) return '';
  if (card.unavailableReason) {
    return `<div class="card card-muted">
  <h3>${escapeHtml(title)}</h3>
  <p class="muted">${escapeHtml(card.unavailableReason)}</p>
</div>`;
  }
  const name = [card.brand, card.model].filter(Boolean).join(' ') || card.model;
  /** @type {string[]} */
  const lines = [`<div><strong>${escapeHtml(name)}</strong></div>`];
  if (card.totalNominalKw != null) {
    lines.push(
      `<div>Номинал: ${escapeHtml(
        card.totalNominalKw.toLocaleString('uk-UA', { maximumFractionDigits: 1 }),
      )} кВт</div>`,
    );
  }
  if (card.price != null) {
    lines.push(`<div>Ориентир цены: ${escapeHtml(money(card.price))}</div>`);
  }
  return `<div class="card">
  <h3>${escapeHtml(title)}</h3>
  ${lines.join('\n  ')}
</div>`;
}

/**
 * @param {unknown} commercial
 * @returns {string}
 */
function commercialTableHtml(commercial) {
  const bom = asObject(commercial);
  if (!bom) return '<p>Нет финансовой сметы.</p>';
  const lines = Array.isArray(bom.lines) ? bom.lines : [];
  const totals = asObject(bom.totals) ?? {};

  const rows = lines
    .map((raw) => {
      if (!isPlainObject(raw)) return '';
      const typeLabel =
        typeof raw.equipmentTypeLabel === 'string'
          ? raw.equipmentTypeLabel
          : typeof raw.categoryId === 'string'
            ? raw.categoryId
            : '—';
      const name =
        [raw.brand, raw.model].filter((x) => typeof x === 'string' && x).join(' ') ||
        typeLabel;
      const qtyNum = typeof raw.qty === 'number' ? raw.qty : null;
      const qty =
        qtyNum != null
          ? `${qtyNum} ${qtyUnitLabel(raw.qtyUnit)}`.trim()
          : '—';
      return `<tr>
        <td>${escapeHtml(typeLabel)}</td>
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(qty)}</td>
        <td>${escapeHtml(money(raw.unitPriceUah))}</td>
        <td>${escapeHtml(money(raw.lineTotalUah))}</td>
      </tr>`;
    })
    .join('');

  return `<table class="bom">
  <thead>
    <tr>
      <th>Тип</th>
      <th>Позиция</th>
      <th>Кол-во</th>
      <th>Цена</th>
      <th>Сумма</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
  <tfoot>
    <tr>
      <td colspan="4">Оборудование</td>
      <td>${escapeHtml(money(totals.equipmentTotalUah))}</td>
    </tr>
    <tr>
      <td colspan="4">Работы</td>
      <td>${escapeHtml(money(totals.laborTotalUah))}</td>
    </tr>
    <tr>
      <td colspan="4">Расходники</td>
      <td>${escapeHtml(money(totals.consumablesTotalUah))}</td>
    </tr>
    <tr>
      <td colspan="4">Итого</td>
      <td>${escapeHtml(money(totals.grandTotalUah))}</td>
    </tr>
  </tfoot>
</table>
<p class="note">Итого по основной (рекомендуемой) линии. Карточки ниже — альтернативные схемы, не меняют сумму сметы.</p>`;
}

/**
 * Собирает полный HTML документ сметы.
 *
 * @param {import('../types/shared-types.js').ProjectShareSnapshot | Record<string, unknown>} snapshot
 * @param {{ includeTechnical?: boolean }} [opts]
 * @returns {string}
 */
export function buildEstimatePdfHtml(snapshot, opts = {}) {
  const snap = asObject(snapshot);
  if (!snap) {
    /** @type {Error & import('../types/shared-types.js').AppErrorLike} */
    const err = new Error('Нет данных для PDF');
    err.statusCode = 400;
    err.code = 'PDF_SNAPSHOT_REQUIRED';
    throw err;
  }

  if (!isPlainObject(snap.commercial)) {
    /** @type {Error & import('../types/shared-types.js').AppErrorLike} */
    const err = new Error('В снимке нет финансовой сметы (commercial)');
    err.statusCode = 400;
    err.code = 'PDF_COMMERCIAL_REQUIRED';
    throw err;
  }

  const clientName = typeof snap.clientName === 'string' ? snap.clientName : 'Клиент';
  const label = typeof snap.label === 'string' ? snap.label : '';
  const objectType =
    snap.objectType === 'apartment' ? 'Квартира' : snap.objectType === 'house' ? 'Дом' : '';
  const publishedAt =
    typeof snap.publishedAt === 'string' ? snap.publishedAt.slice(0, 10) : '';

  const matching = asObject(snap.matching);
  const boiler = matching ? asObject(matching.boiler) : null;
  const mainProposal = boiler ? readProposalCard(asObject(boiler.proposal)) : null;
  const economy = boiler ? readProposalCard(asObject(boiler.proposalEconomy)) : null;
  const efficient = boiler ? readProposalCard(asObject(boiler.proposalEfficient)) : null;

  const mainBlock = mainProposal
    ? proposalCardHtml('Рекомендуемый комплект (основная линия)', mainProposal)
    : '';

  const altCards = [proposalCardHtml('Экономичный', economy), proposalCardHtml('Эффективный', efficient)]
    .filter(Boolean)
    .join('\n');

  const technical =
    opts.includeTechnical === true ? buildTechnicalPdfHtml(snap) : '';

  const title = 'Финансовый итог — HeatCalc Pro';

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: "DejaVu Sans", "Liberation Sans", Arial, sans-serif; color: #1a1a1a; margin: 24px; font-size: 12px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    h2 { font-size: 16px; margin: 24px 0 10px; }
    h3 { font-size: 13px; margin: 0 0 8px; }
    .meta { color: #444; margin-bottom: 16px; line-height: 1.45; }
    .brand { color: #1e4d8c; font-weight: 700; font-size: 14px; margin-bottom: 4px; }
    table.bom, table.tech { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f3f3f3; }
    tfoot td { font-weight: bold; }
    .cards { display: flex; flex-wrap: wrap; gap: 12px; margin: 12px 0 8px; }
    .card { border: 1px solid #c5d0de; border-radius: 6px; padding: 12px 14px; min-width: 220px; flex: 1; background: #f8fafc; }
    .card-muted { background: #f5f5f5; border-color: #ddd; }
    .muted { color: #666; margin: 0; }
    .note { color: #555; font-size: 11px; margin-top: 8px; }
    ul { margin: 8px 0 12px; padding-left: 18px; }
    @page { margin: 12mm; }
  </style>
</head>
<body>
  <div class="brand">HeatCalc Pro</div>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">
    <div>Клиент: ${escapeHtml(clientName)}</div>
    ${label ? `<div>Проект: ${escapeHtml(label)}</div>` : ''}
    ${objectType ? `<div>Объект: ${escapeHtml(objectType)}</div>` : ''}
    ${publishedAt ? `<div>Дата: ${escapeHtml(publishedAt)}</div>` : ''}
  </div>
  ${mainBlock ? `<div class="cards">${mainBlock}</div>` : ''}
  <h2>Смета</h2>
  ${commercialTableHtml(snap.commercial)}
  ${
    altCards
      ? `<h2>Альтернативные схемы котла</h2>
  <p class="note">Сравнение с основной линией. Сумма таблицы выше не пересчитывается.</p>
  <div class="cards">${altCards}</div>`
      : ''
  }
  ${technical}
</body>
</html>`;
}
