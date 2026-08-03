/**
 * Назначение: контракт Dev-экспорта/импорта проекта между окружениями.
 */

import type { CalcReportJson } from './calcApi';
import type { CalculationSummary } from './projectsApi';
import type { SurveyDraft } from './surveyDraft';

/** Поддерживаемая версия ProjectExportBundle (синхронно с backend). */
export const PROJECT_EXPORT_SCHEMA_VERSION = 1 as const;

export type ProjectExportCalculationItem = {
  calcInput: unknown;
  report: CalcReportJson;
  summary: CalculationSummary;
  /** ISO — порядок при импорте, не Mongo _id */
  sourceCreatedAt?: string;
};

export type ProjectExportBundle = {
  exportSchemaVersion: typeof PROJECT_EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  source?: {
    projectId?: string;
    calculationsTotal?: number;
  };
  project: {
    clientName: string;
    label?: string;
    survey: Omit<SurveyDraft, 'projectId' | 'lastCalcReport'>;
    lastCalcInput?: unknown;
  };
  calculations: ProjectExportCalculationItem[];
};

/**
 * Имя файла Dev-экспорта.
 *
 * @param clientName
 * @param exportedAtIso
 */
export function buildProjectExportFilename(clientName: string, exportedAtIso: string): string {
  const safe = clientName
    .replace(/[^\p{L}\p{N}\-_]+/gu, '_')
    .slice(0, 40);
  const date = exportedAtIso.slice(0, 10);
  return `project-export-${safe || 'project'}-${date}.json`;
}

/**
 * Survey для export: merge server+local, без projectId и lastCalcReport.
 *
 * @param localDraft
 * @param serverSurveyRaw
 */
export function mergeSurveyForExport(
  localDraft: SurveyDraft,
  serverSurveyRaw: unknown,
): Omit<SurveyDraft, 'projectId' | 'lastCalcReport'> {
  let base: SurveyDraft = structuredClone(localDraft);
  if (
    serverSurveyRaw !== undefined
    && serverSurveyRaw !== null
    && typeof serverSurveyRaw === 'object'
    && !Array.isArray(serverSurveyRaw)
  ) {
    base = {
      ...(serverSurveyRaw as SurveyDraft),
      ...structuredClone(localDraft),
    };
  }
  const { projectId: _pid, lastCalcReport: _report, ...survey } = base;
  void _pid;
  void _report;
  return survey;
}

/**
 * @param bundle
 */
export function estimateProjectExportJsonBytes(bundle: ProjectExportBundle): number {
  return JSON.stringify(bundle).length;
}
