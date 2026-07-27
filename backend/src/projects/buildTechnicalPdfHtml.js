/**
 * Назначение: HTML техблока для серверного PDF (из shareSnapshot / report-like).
 * Описание: Упрощённый порт секций без frontend-парсеров; поля читаются напрямую.
 */

import { isPlainObject } from '../utils/isPlainObject.js';
import { escapeHtml } from './pdfHtmlEscape.js';

/**
 * @param {unknown} value
 * @returns {Record<string, unknown> | null}
 */
function asObject(value) {
  return isPlainObject(value) ? value : null;
}

/**
 * @param {number} watts
 * @param {number} [digits]
 * @returns {string}
 */
function formatKwFromWatts(watts, digits = 1) {
  return (watts / 1000).toLocaleString('uk-UA', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

/**
 * @param {number} kw
 * @param {number} [digits]
 * @returns {string}
 */
function formatKw(kw, digits = 1) {
  return kw.toLocaleString('uk-UA', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

/**
 * @param {string} title
 * @param {Array<[string, string]>} rows
 * @returns {string}
 */
function kvTable(title, rows) {
  if (rows.length === 0) return '';
  const body = rows
    .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join('');
  return `<h3>${escapeHtml(title)}</h3>
<table class="tech">
  <thead><tr><th>Показник</th><th>Значення</th></tr></thead>
  <tbody>${body}</tbody>
</table>`;
}

/**
 * @param {string} title
 * @param {string[]} headers
 * @param {string[][]} rows
 * @returns {string}
 */
function dataTable(title, headers, rows) {
  if (rows.length === 0) return '';
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<h3>${escapeHtml(title)}</h3>
<table class="tech">
  <thead><tr>${head}</tr></thead>
  <tbody>${body}</tbody>
</table>`;
}

/**
 * @param {unknown} snapshotOrReport
 * @returns {string} HTML-фрагмент или пустая строка
 */
export function buildTechnicalPdfHtml(snapshotOrReport) {
  const root = asObject(snapshotOrReport);
  if (!root) return '';

  const parts = [];
  const calculations = asObject(root.calculations);
  const matching = asObject(root.matching);

  const heatLoss = calculations ? asObject(calculations.heatLoss) : null;
  if (heatLoss && typeof heatLoss.totalWatts === 'number') {
    const heatLossKw = heatLoss.totalWatts / 1000;
    const reserve = heatLossKw * 0.15;
    /** @type {Array<[string, string]>} */
    const rows = [
      ['Потужність приміщень', `${formatKw(heatLossKw)} кВт`],
      ['Запас', `${formatKw(reserve)} кВт`],
      ['Разом із запасом', `${formatKw(heatLossKw + reserve)} кВт`],
    ];
    parts.push(kvTable('Тепловтрати', rows));
    const byRoom = Array.isArray(heatLoss.byRoom) ? heatLoss.byRoom : [];
    /** @type {string[][]} */
    const roomRows = [];
    for (const item of byRoom) {
      if (!isPlainObject(item)) continue;
      const name =
        typeof item.roomName === 'string'
          ? item.roomName
          : typeof item.name === 'string'
            ? item.name
            : typeof item.roomId === 'string'
              ? item.roomId
              : '—';
      const watts =
        typeof item.totalWatts === 'number'
          ? item.totalWatts
          : typeof item.heatLossWatts === 'number'
            ? item.heatLossWatts
            : null;
      if (watts == null) continue;
      roomRows.push([name, `${formatKwFromWatts(watts, 2)} кВт`]);
    }
    if (roomRows.length > 0) {
      parts.push(dataTable('Тепловтрати за приміщеннями', ['Приміщення', 'Потужність'], roomRows));
    }
  }

  const hotWater = calculations ? asObject(calculations.hotWater) : null;
  if (hotWater && typeof hotWater.hotWaterPowerKw === 'number') {
    /** @type {Array<[string, string]>} */
    const rows = [['Пікова потужність ГВП', `${formatKw(hotWater.hotWaterPowerKw)} кВт`]];
    if (typeof hotWater.peakFlowLps === 'number') {
      rows.push([
        'Пікова витрата',
        `${hotWater.peakFlowLps.toLocaleString('uk-UA', { maximumFractionDigits: 3 })} л/с`,
      ]);
    }
    if (typeof hotWater.recommendedTankLiters === 'number') {
      rows.push(['Рекомендований бак', `${Math.round(hotWater.recommendedTankLiters)} л`]);
    }
    parts.push(kvTable('Гаряча вода', rows));
  }

  const boiler = matching ? asObject(matching.boiler) : null;
  if (boiler) {
    /** @type {Array<[string, string]>} */
    const rows = [];
    if (typeof boiler.requiredKw === 'number') {
      rows.push(['Потрібна потужність котла', `${formatKw(boiler.requiredKw)} кВт`]);
    }
    const proposal = asObject(boiler.proposal);
    if (proposal && typeof proposal.model === 'string') {
      rows.push(['Пропозиція (основна)', proposal.model]);
      if (typeof proposal.totalNominalKw === 'number') {
        rows.push(['Номінал', `${formatKw(proposal.totalNominalKw)} кВт`]);
      }
    }
    if (rows.length) parts.push(kvTable('Котел', rows));
  }

  const radiators = matching ? asObject(matching.radiators) : null;
  if (radiators) {
    if (radiators.skipped === true || radiators.status === 'skipped') {
      parts.push(kvTable('Радіатори', [['Статус', 'не потрібні (режим лише ТП)']]));
    } else {
      /** @type {Array<[string, string]>} */
      const rows = [];
      if (typeof radiators.chosenModel === 'string') {
        rows.push(['Модель (основна лінія)', radiators.chosenModel]);
      }
      if (typeof radiators.totalSections === 'number') {
        rows.push(['Секцій (осн.)', String(radiators.totalSections)]);
      }
      if (rows.length) parts.push(kvTable('Радіатори', rows));
    }
  }

  const ufh = calculations ? asObject(calculations.underfloorHeating) : null;
  if (ufh && Array.isArray(ufh.rooms) && ufh.rooms.length > 0) {
    parts.push(kvTable('Тепла підлога', [['Кімнат з ТП', String(ufh.rooms.length)]]));
  }

  const hydraulicsCalc = calculations ? asObject(calculations.hydraulics) : null;
  if (hydraulicsCalc) {
    /** @type {Array<[string, string]>} */
    const rows = [];
    if (typeof hydraulicsCalc.flowRateM3PerHour === 'number') {
      rows.push([
        'Витрата',
        `${hydraulicsCalc.flowRateM3PerHour.toLocaleString('uk-UA', { maximumFractionDigits: 3 })} м³/ч`,
      ]);
    }
    if (typeof hydraulicsCalc.headRequiredM === 'number') {
      rows.push([
        'Потрібний напір',
        `${hydraulicsCalc.headRequiredM.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} м`,
      ]);
    }
    if (rows.length) parts.push(kvTable('Гідравліка', rows));
  }

  if (Array.isArray(root.warnings) && root.warnings.length > 0) {
    const warns = root.warnings.filter((w) => typeof w === 'string').slice(0, 40);
    if (warns.length > 0) {
      parts.push(
        `<h3>Попередження</h3><ul>${warns
          .map((w) => `<li>${escapeHtml(w)}</li>`)
          .join('')}</ul>`,
      );
    }
  }

  if (parts.length === 0) return '';
  return `<h2>Технічний розрахунок</h2>${parts.join('\n')}`;
}
