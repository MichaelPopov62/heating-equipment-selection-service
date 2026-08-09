/**
 * Назначение: общая логика Dev-экспорта и admin-импорта ProjectExportBundle.
 * Описание: send — скачивание bundle; receive — POST /projects/import.
 */

import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '../query/queryKeys';
import { fetchProjectExportBundle } from '../services/fetchProjectExportBundle';
import { importProject } from '../services/projectsApi';
import type { CalcReportJson } from '../types/calcApi';
import type { ProjectDetail } from '../types/projectsApi';
import {
  buildProjectExportFilename,
  estimateProjectExportJsonBytes,
  type ProjectExportBundle,
} from '../types/projectExport';
import type { SurveyDraft } from '../types/surveyDraft';
import { SURVEY_DRAFT_SCHEMA_VERSION } from '../types/surveyDraft';
import { downloadJsonFile } from './fileDownload';
import { parseSurveyDraft } from './parsers/parseSurveyDraft';
import { buildSurveyDraftAfterImport, parseProjectImportFile } from './parsers/parseProjectImportFile';

export type ProjectBundleImportResult = {
  project: ProjectDetail;
  calculationsImported: number;
  draft: SurveyDraft;
  latestReport: CalcReportJson | null;
};

export type ProjectBundleExportParams = {
  projectId: string | null;
  clientName: string;
  localDraft?: SurveyDraft;
  localLastCalcInput?: unknown;
};

/**
 * @param message
 */
export function mapProjectImportErrorMessage(message: string): string {
  if (message.includes('401') || message.includes('PROJECTS_AUTH')) {
    return 'Увійдіть у систему перед імпортом';
  }
  if (message.includes('ADMIN_REQUIRED') || message.includes('403')) {
    return 'Імпорт доступний лише адміністратору (role=admin)';
  }
  if (message.includes('503') || message.includes('MONGODB_UNAVAILABLE')) {
    return 'MongoDB недоступна — імпорт неможливий';
  }
  if (message.includes('413')) {
    return 'Файл занадто великий для імпорту';
  }
  return message;
}

/**
 * Мінімальний draft для експорту зі списку проєктів (дані з сервера).
 *
 * @param clientName
 */
function buildMinimalExportDraft(clientName: string): SurveyDraft {
  return parseSurveyDraft({
    schemaVersion: SURVEY_DRAFT_SCHEMA_VERSION,
    clientName,
    savedAt: new Date().toISOString(),
  });
}

/**
 * Прийняти bundle з файлу — імпорт на сервер.
 *
 * @param file
 * @param queryClient
 */
export async function receiveProjectBundle(
  file: File,
  queryClient: QueryClient,
): Promise<ProjectBundleImportResult> {
  const text = await file.text();
  const raw: unknown = JSON.parse(text);
  const { importBody, latestReport } = parseProjectImportFile(raw);
  const result = await importProject(importBody);
  const draft = buildSurveyDraftAfterImport(result.project, importBody, latestReport);

  await queryClient.invalidateQueries({ queryKey: ['projects'] });
  await queryClient.invalidateQueries({
    queryKey: queryKeys.projectCalculations(result.project.id),
  });

  return {
    project: result.project,
    calculationsImported: result.calculationsImported,
    draft,
    latestReport,
  };
}

/**
 * @param bundle
 */
export function confirmLargeProjectExport(bundle: ProjectExportBundle): boolean {
  const bytes = estimateProjectExportJsonBytes(bundle);
  if (bytes <= 900_000) return true;
  return window.confirm(
    `Файл експорту ~${Math.round(bytes / 1024)} KB. Продовжити завантаження?`,
  );
}

/**
 * Відправити bundle — експорт на диск.
 *
 * @param queryClient
 * @param params
 */
export async function sendProjectBundle(
  queryClient: QueryClient,
  params: ProjectBundleExportParams,
): Promise<{ filename: string; calculationsCount: number }> {
  const localDraft = params.localDraft ?? buildMinimalExportDraft(params.clientName);

  const bundle = await fetchProjectExportBundle({
    projectId: params.projectId,
    localDraft,
    localLastCalcInput: params.localLastCalcInput,
    queryClient,
  });

  if (!confirmLargeProjectExport(bundle)) {
    throw new Error('Експорт скасовано');
  }

  const filename = buildProjectExportFilename(bundle.project.clientName, bundle.exportedAt);
  downloadJsonFile(filename, bundle);

  return {
    filename,
    calculationsCount: bundle.calculations.length,
  };
}
