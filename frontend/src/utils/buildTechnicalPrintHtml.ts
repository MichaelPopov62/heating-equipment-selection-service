/**
 * Назначение: HTML-приложение «Технический расчёт» для печати / PDF.
 * Описание: Собирает секции как на шаге technicalResult (не stub из 2–3 KPI).
 */

import { HOT_WATER_BOILER_MATCHING_SCHEME_ENUM } from '../types/heatingMatching';
import type { HotWaterBoilerPowerMatchingScheme } from '../types/heatingMatching';
import type { CalcReportJson } from '../types/calcApi';
import type { PublicSharePayload } from '../types/projectsApi';
import { heatLossReserveKw, heatLossTotalKw, wattsToKilowatts } from './calculators/heatLoss';
import { formatKw } from './format';
import { isRecord, readRecordField } from './jsonGuards';
import { parseBoilerFromReport } from './parsers/parseBoilerFromReport';
import { parseHotWaterFromReport } from './parsers/parseHotWaterFromReport';
import {
  formatRadiatorsEmittersSummaryLabel,
  parseRadiatorsMatchingFromReport,
} from './parsers/parseRadiatorsMatchingFromReport';
import { parseIndirectWaterHeaterMatchingFromReport } from './parsers/parseIndirectWaterHeaterMatchingFromReport';
import { parseWaterHeaterMatchingFromReport } from './parsers/parseWaterHeaterMatchingFromReport';
import { parseUnderfloorHeatingFromReport } from './parsers/parseUnderfloorHeatingFromReport';
import { parseHydraulicsFromReport } from './parsers/parseHydraulicsFromReport';
import { isRadiatorsMatchingSkipped } from './radiatorsSkip';

const SCHEME_SET = new Set<string>(HOT_WATER_BOILER_MATCHING_SCHEME_ENUM);

/**
 * @param v
 */
function isCalcMatchingScheme(v: string): v is HotWaterBoilerPowerMatchingScheme {
  return SCHEME_SET.has(v);
}

/**
 * @param s
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param title
 * @param rows
 */
function kvTable(title: string, rows: Array<[string, string]>): string {
  if (rows.length === 0) return '';
  const body = rows
    .map(
      ([k, v]) =>
        `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`,
    )
    .join('');
  return `<h3>${escapeHtml(title)}</h3>
<table class="tech">
  <thead><tr><th>Показник</th><th>Значення</th></tr></thead>
  <tbody>${body}</tbody>
</table>`;
}

/**
 * @param title
 * @param headers
 * @param rows
 */
function dataTable(title: string, headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '';
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows
    .map(
      (r) =>
        `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`,
    )
    .join('');
  return `<h3>${escapeHtml(title)}</h3>
<table class="tech">
  <thead><tr>${head}</tr></thead>
  <tbody>${body}</tbody>
</table>`;
}

/**
 * Синтетический report из публичного share (те же parsers, что для calc).
 *
 * @param share
 */
export function reportLikeFromPublicShare(share: PublicSharePayload): CalcReportJson {
  return {
    commercial: share.commercial,
    matching: share.matching,
    calculations: share.calculations,
    ...(share.warnings ? { warnings: share.warnings } : {}),
    ...(share.temps ? { temps: share.temps } : {}),
    ...(share.catalogSource || share.reportGeneratedAt
      ? {
          meta: {
            ...(share.catalogSource ? { catalogSource: share.catalogSource } : {}),
            ...(share.reportGeneratedAt
              ? { generatedAt: share.reportGeneratedAt }
              : {}),
          },
        }
      : {}),
  };
}

/**
 * Полный HTML техрасчёта для печати (секции как на technicalResult).
 *
 * @param calcReport
 * @returns HTML или пустая строка
 */
export function buildTechnicalPrintHtml(calcReport: CalcReportJson | null | undefined): string {
  if (calcReport == null || !isRecord(calcReport)) return '';

  const parts: string[] = [];

  const calculations = readRecordField(calcReport, 'calculations');
  const heatLoss = calculations ? readRecordField(calculations, 'heatLoss') : null;
  if (heatLoss && typeof heatLoss.totalWatts === 'number') {
    const heatLossKw = wattsToKilowatts(heatLoss.totalWatts);
    const rows: Array<[string, string]> = [
      ['Потужність приміщень', `${formatKw(heatLossKw, 1)} кВт`],
      ['Запас', `${formatKw(heatLossReserveKw(heatLossKw), 1)} кВт`],
      ['Разом із запасом', `${formatKw(heatLossTotalKw(heatLossKw), 1)} кВт`],
    ];
    const byRoom = Array.isArray(heatLoss.byRoom) ? heatLoss.byRoom : [];
    const roomRows: string[][] = [];
    for (const item of byRoom) {
      if (!isRecord(item)) continue;
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
      roomRows.push([name, `${formatKw(wattsToKilowatts(watts), 2)} кВт`]);
    }
    parts.push(kvTable('Тепловтрати', rows));
    if (roomRows.length > 0) {
      parts.push(dataTable('Тепловтрати за приміщеннями', ['Приміщення', 'Потужність'], roomRows));
    }
  }

  const hotWater = parseHotWaterFromReport(calcReport);
  if (hotWater) {
    const rows: Array<[string, string]> = [
      ['Пікова потужність ГВП', `${formatKw(hotWater.hotWaterPowerKw)} кВт`],
      ['Пікова витрата', `${hotWater.peakFlowLps.toLocaleString('uk-UA', { maximumFractionDigits: 3 })} л/с`],
    ];
    if (hotWater.recommendedTankLiters != null) {
      rows.push(['Рекомендований бак', `${Math.round(hotWater.recommendedTankLiters)} л`]);
    }
    if (hotWater.dhwSupplyScenario) {
      rows.push([
        'Сценарій',
        hotWater.dhwSupplyScenario === 'storage' ? 'накопичувальний' : 'проточний',
      ]);
    }
    if (hotWater.residents != null) {
      rows.push(['Мешканці', String(hotWater.residents)]);
    }
    if (hotWater.hotWaterC != null && hotWater.designColdWaterC != null) {
      rows.push([
        'Температури ГВ / ХВ',
        `${hotWater.hotWaterC} / ${hotWater.designColdWaterC} °C`,
      ]);
    }
    parts.push(kvTable('Гаряча вода', rows));
  }

  const boiler = parseBoilerFromReport(calcReport, isCalcMatchingScheme);
  if (boiler?.summary) {
    const s = boiler.summary;
    const rows: Array<[string, string]> = [
      ['Тепловтрати', `${formatKw(s.heatLossKw)} кВт`],
      [`Опалення ×${s.reserveFactor}`, `${formatKw(s.heatingLoadKw)} кВт`],
      ['Потужність ГВП', `${formatKw(s.hotWaterPowerKw)} кВт`],
      ['Потрібна потужність котла', `${formatKw(s.requiredKw)} кВт`],
    ];
    const proposal =
      boiler.tierEconomy ?? boiler.legacyProposal ?? boiler.tierEfficient;
    if (proposal) {
      rows.push(['Пропозиція', `${proposal.headline}: ${proposal.model}`]);
      rows.push(['Номінал', `${formatKw(proposal.totalNominalKw)} кВт`]);
    }
    parts.push(kvTable('Котел', rows));
    if (boiler.warnings.length > 0) {
      parts.push(
        `<h3>Попередження котла</h3><ul>${boiler.warnings
          .map((w) => `<li>${escapeHtml(w)}</li>`)
          .join('')}</ul>`,
      );
    }
  }

  const radiators = parseRadiatorsMatchingFromReport(calcReport);
  if (radiators && !isRadiatorsMatchingSkipped(radiators)) {
    const rows: Array<[string, string]> = [];
    if (radiators.chosenModel) rows.push(['Модель (основна лінія)', radiators.chosenModel]);
    const emitters = formatRadiatorsEmittersSummaryLabel(radiators.emittersSummary);
    if (emitters) rows.push(['Прилади', emitters]);
    if (radiators.totalSections != null) {
      rows.push(['Секцій (осн.)', String(radiators.totalSections)]);
    }
    const eco = formatRadiatorsEmittersSummaryLabel(radiators.lineEconomy?.emittersSummary);
    const eff = formatRadiatorsEmittersSummaryLabel(radiators.lineEfficient?.emittersSummary);
    if (eco) rows.push(['Лінія «Економ»', eco]);
    if (eff) rows.push(['Лінія «Ефективний»', eff]);
    if (radiators.inputs?.supplyC != null && radiators.inputs.returnC != null) {
      rows.push([
        'Графік',
        `${radiators.inputs.supplyC}/${radiators.inputs.returnC} °C`,
      ]);
    }
    parts.push(kvTable('Радіатори', rows));

    const byRoomRows = radiators.byRoom
      .filter((r) => r.displayKind !== 'none')
      .map((r) => {
        const qty =
          r.displayKind === 'panel'
            ? `${r.unitsCount ?? 1} шт.${r.panelLengthMm != null ? ` · ${r.panelLengthMm} мм` : ''}`
            : r.sections != null
              ? `${r.sections} сек.`
              : '—';
        return [
          r.roomName || r.roomId,
          r.radiatorModel ?? '—',
          qty,
          r.deliverableWatts != null ? `${Math.round(r.deliverableWatts)} Вт` : '—',
        ];
      });
    if (byRoomRows.length > 0) {
      parts.push(
        dataTable(
          'Радіатори за приміщеннями',
          ['Приміщення', 'Модель', 'К-сть', 'Віддача'],
          byRoomRows,
        ),
      );
    }
  } else if (radiators && isRadiatorsMatchingSkipped(radiators)) {
    parts.push(kvTable('Радіатори', [['Статус', 'не потрібні (режим лише ТП)']]));
  }

  const indirect = parseIndirectWaterHeaterMatchingFromReport(calcReport);
  if (indirect) {
    const rows: Array<[string, string]> = [];
    if (indirect.selectedModel) rows.push(['Модель БКН', indirect.selectedModel]);
    if (indirect.volumeLiters != null) {
      rows.push(['Об\'єм', `${Math.round(indirect.volumeLiters)} л`]);
    }
    if (indirect.coilPowerKw != null) {
      rows.push(['Потужність змійовика', `${formatKw(indirect.coilPowerKw)} кВт`]);
    }
    if (rows.length) parts.push(kvTable('Бойлер непрямого нагріву', rows));
  }

  const electricWh = parseWaterHeaterMatchingFromReport(calcReport);
  if (electricWh) {
    const rows: Array<[string, string]> = [];
    if (electricWh.selectedModel) rows.push(['Модель', electricWh.selectedModel]);
    if (electricWh.volumeLiters != null) {
      rows.push(['Об\'єм', `${Math.round(electricWh.volumeLiters)} л`]);
    }
    if (electricWh.powerKw != null) {
      rows.push(['Потужність', `${formatKw(electricWh.powerKw)} кВт`]);
    }
    if (rows.length) parts.push(kvTable('Електронакопичувач', rows));
  }

  const ufh = parseUnderfloorHeatingFromReport(calcReport);
  if (ufh && ufh.rooms.length > 0) {
    const rows: Array<[string, string]> = [
      ['Кімнат з ТП', String(ufh.rooms.length)],
    ];
    if (ufh.totalHeatFluxUpWatts > 0) {
      rows.push([
        'Сумарний потік вгору',
        `${formatKw(wattsToKilowatts(ufh.totalHeatFluxUpWatts))} кВт`,
      ]);
    }
    if (ufh.mixingNode) {
      rows.push([
        'Змішувальний вузол',
        `котел ${ufh.mixingNode.boilerSupplyC ?? '—'} °C → контур ${ufh.mixingNode.floorCircuitSupplyC ?? '—'} °C`,
      ]);
    }
    parts.push(kvTable('Тепла підлога', rows));

    const roomRows = ufh.rooms.map((r) => [
      r.roomName || r.roomId,
      r.heatedAreaM2 != null ? `${r.heatedAreaM2.toLocaleString('uk-UA')} м²` : '—',
      `${formatKw(wattsToKilowatts(r.heatFluxUpWatts), 2)} кВт`,
      r.loopsCount != null ? String(r.loopsCount) : '—',
    ]);
    parts.push(
      dataTable(
        'Тепла підлога за приміщеннями',
        ['Приміщення', 'Активна площа', 'Потік вгору', 'Петлі'],
        roomRows,
      ),
    );
  }

  const hydraulics = parseHydraulicsFromReport(calcReport);
  if (hydraulics?.calculations) {
    const c = hydraulics.calculations;
    const rows: Array<[string, string]> = [
      ['Витрата', `${c.flowRateM3PerHour.toLocaleString('uk-UA', { maximumFractionDigits: 3 })} м³/ч`],
      ['Потрібний напір', `${c.headRequiredM.toLocaleString('uk-UA', { maximumFractionDigits: 2 })} м`],
    ];
    if (c.recommendedPipeDiameter) {
      rows.push(['Рекомендований діаметр', c.recommendedPipeDiameter]);
    }
    if (c.deltaTSystemK != null) {
      rows.push(['ΔT системи', `${c.deltaTSystemK} K`]);
    }
    const pump = hydraulics.proposal?.pumps[0] ?? hydraulics.proposal?.pump ?? null;
    if (pump) {
      const label = [pump.brand, pump.model].filter(Boolean).join(' ');
      if (label) rows.push(['Насос', label]);
    }
    parts.push(kvTable('Гідравліка', rows));
  }

  if (Array.isArray(calcReport.warnings) && calcReport.warnings.length > 0) {
    const warns = calcReport.warnings.filter((w): w is string => typeof w === 'string');
    if (warns.length > 0) {
      parts.push(
        `<h3>Попередження</h3><ul>${warns
          .slice(0, 40)
          .map((w) => `<li>${escapeHtml(w)}</li>`)
          .join('')}</ul>`,
      );
    }
  }

  if (parts.length === 0) return '';
  return `<h2>Технічний розрахунок</h2>${parts.join('\n')}`;
}
