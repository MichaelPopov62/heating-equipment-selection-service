/**
 * Назначение: Экспорт и шаринг анкеты.
 * Описание: Текстовая сводка, Web Share API и кодирование черновика в URL-hash.
 */

import type { CalcReportJson } from '../types/calcApi';
import type { SurveyDraft } from '../types/surveyDraft';
import { wattsToKilowatts } from './calculators/heatLoss';
import { formatKw } from './format';
import { isRecord } from './jsonGuards';
import { parseSurveyDraft } from './parseSurveyDraft';

const URL_HASH_PREFIX = '#survey=';

/** Краткая текстовая сводка для экспорта / Share API. */
export function buildSurveyTextSummary(
  draft: SurveyDraft,
  report?: CalcReportJson | null,
): string {
  const lines: string[] = [
    `Клиент: ${draft.clientName}`,
    `Объект: ${draft.objectMeta.objectType}, этажей ${draft.objectMeta.floors}, помещений ${draft.rooms.length}`,
    `Температуры: внутри ${draft.temps.insideC} °C, снаружи ${draft.temps.outsideC} °C` +
      (typeof draft.temps.bathroomAirTempC === 'number'
        ? `, воздух санузла ${draft.temps.bathroomAirTempC} °C`
        : ''),
    `Сохранено: ${draft.savedAt}`,
  ];
  const calculations = report && isRecord(report.calculations) ? report.calculations : null;
  const heatLoss =
    calculations && isRecord(calculations.heatLoss) ? calculations.heatLoss : null;
  if (heatLoss && typeof heatLoss.totalWatts === 'number') {
    lines.push(
      `Теплопотери: ${formatKw(wattsToKilowatts(heatLoss.totalWatts))} кВт`,
    );
  }
  const matching = report && isRecord(report.matching) ? report.matching : null;
  const boiler = matching && isRecord(matching.boiler) ? matching.boiler : null;
  if (boiler && typeof boiler.requiredKw === 'number') {
    lines.push(`Котёл: требуется ${formatKw(boiler.requiredKw)} кВт`);
  }
  const selected = boiler && isRecord(boiler.selected) ? boiler.selected : null;
  const proposal = boiler && isRecord(boiler.proposal) ? boiler.proposal : null;
  const model =
    (selected && typeof selected.model === 'string' ? selected.model : null) ??
    (proposal && typeof proposal.model === 'string' ? proposal.model : null);
  if (model) lines.push(`Модель: ${model}`);
  if (report && Array.isArray(report.warnings) && report.warnings.length > 0) {
    lines.push(`Предупреждений: ${report.warnings.length}`);
  }
  return lines.join('\n');
}

/** Черновик без отчёта для URL (лимит длины адресной строки). */
export function surveyDraftForUrlShare(draft: SurveyDraft): SurveyDraft {
  const { lastCalcReport: _drop, ...rest } = draft;
  void _drop;
  return { ...rest, lastCalcReport: undefined };
}

export function encodeSurveyDraftToUrl(draft: SurveyDraft): string {
  const compact = surveyDraftForUrlShare(draft);
  const json = JSON.stringify(compact);
  const b64 = btoa(
    encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    ),
  );
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}${URL_HASH_PREFIX}${b64}`;
}

export function decodeSurveyDraftFromHash(hash: string): SurveyDraft | null {
  if (!hash.startsWith(URL_HASH_PREFIX)) return null;
  try {
    const b64 = hash.slice(URL_HASH_PREFIX.length);
    const json = decodeURIComponent(
      Array.from(atob(b64), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(
        '',
      ),
    );
    return parseSurveyDraft(JSON.parse(json));
  } catch {
    return null;
  }
}

export async function shareSurveyText(title: string, text: string): Promise<boolean> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text });
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false;
      throw err;
    }
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error('Буфер обмена недоступен в этом браузере');
}
