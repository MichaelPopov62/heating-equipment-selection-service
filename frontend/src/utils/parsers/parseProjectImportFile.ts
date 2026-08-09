/**
 * Назначение: парсинг JSON-файла для Dev-импорта проекта.
 * Описание: ProjectExportBundle v1 или legacy SurveyDraft → тело POST /projects/import.
 */

import type { CalcReportJson } from '../../types/calcApi';
import type { ProjectDetail } from '../../types/projectsApi';
import { PROJECT_EXPORT_SCHEMA_VERSION } from '../../types/projectExport';
import type { SurveyDraft } from '../../types/surveyDraft';
import { isRecord } from '../jsonGuards';
import { parseSurveyDraft } from './parseSurveyDraft';

export type ParsedProjectImportFile = {
  importBody: Record<string, unknown>;
  latestReport: CalcReportJson | null;
};

/**
 * @param calculations
 */
function pickLatestReportFromCalculations(calculations: unknown[]): CalcReportJson | null {
  /** @type {Array<{ sourceCreatedAt?: string; report?: CalcReportJson }>} */
  const items = calculations
    .filter(isRecord)
    .map((item) => ({
      sourceCreatedAt:
        typeof item.sourceCreatedAt === 'string' ? item.sourceCreatedAt : undefined,
      report:
        item.report && typeof item.report === 'object' && !Array.isArray(item.report)
          ? (item.report as CalcReportJson)
          : undefined,
    }))
    .filter((item) => item.report !== undefined);

  if (items.length === 0) return null;

  items.sort((left, right) => {
    const leftTs = left.sourceCreatedAt ? Date.parse(left.sourceCreatedAt) : Number.NaN;
    const rightTs = right.sourceCreatedAt ? Date.parse(right.sourceCreatedAt) : Number.NaN;
    const leftKey = Number.isFinite(leftTs) ? leftTs : Number.MIN_SAFE_INTEGER;
    const rightKey = Number.isFinite(rightTs) ? rightTs : Number.MIN_SAFE_INTEGER;
    return rightKey - leftKey;
  });

  return items[0]?.report ?? null;
}

/**
 * @param raw
 */
export function parseProjectImportFile(raw: unknown): ParsedProjectImportFile {
  if (!isRecord(raw)) {
    throw new Error('JSON має бути обʼєктом');
  }

  if (raw.exportSchemaVersion === PROJECT_EXPORT_SCHEMA_VERSION) {
    if (!isRecord(raw.project)) {
      throw new Error('Некоректний ProjectExportBundle: немає project');
    }
    if (typeof raw.project.clientName !== 'string' || !raw.project.clientName.trim()) {
      throw new Error('Некоректний ProjectExportBundle: clientName');
    }
    if (!Array.isArray(raw.calculations)) {
      throw new Error('Некоректний ProjectExportBundle: calculations');
    }
    return {
      importBody: raw,
      latestReport: pickLatestReportFromCalculations(raw.calculations),
    };
  }

  parseSurveyDraft(raw);

  let latestReport: CalcReportJson | null = null;
  const lastCalcReport = raw.lastCalcReport;
  if (lastCalcReport && typeof lastCalcReport === 'object' && !Array.isArray(lastCalcReport)) {
    latestReport = lastCalcReport as CalcReportJson;
  } else if (Array.isArray(raw.calculations)) {
    latestReport = pickLatestReportFromCalculations(raw.calculations);
  }

  return { importBody: raw, latestReport };
}

/**
 * SurveyDraft для UI после успешного POST /projects/import.
 *
 * @param project
 * @param importBody
 * @param latestReport
 */
export function buildSurveyDraftAfterImport(
  project: ProjectDetail,
  importBody: Record<string, unknown>,
  latestReport: CalcReportJson | null,
): SurveyDraft {
  const surveyCandidate =
    project.survey
    ?? (isRecord(importBody.project) ? importBody.project.survey : undefined)
    ?? importBody;

  const draft = parseSurveyDraft(surveyCandidate);
  draft.projectId = project.id;
  draft.clientName = project.clientName;
  if (latestReport) {
    draft.lastCalcReport = latestReport;
  }
  return draft;
}
