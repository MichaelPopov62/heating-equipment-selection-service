/**
 * Назначение: сборка ProjectExportBundle с сервера (полная история calculations).
 * Описание: cache React Query или paginate list + GET detail для каждого расчёта.
 */

import type { QueryClient } from '@tanstack/react-query';

import { queryKeys } from '../query/queryKeys';
import type {
  CalculationDetail,
  CalculationsListResponse,
} from '../types/projectsApi';
import {
  buildProjectExportBundleFromParts,
  buildSessionOnlyExportBundle,
} from '../utils/buildProjectExportBundle';
import type { ProjectExportBundle } from '../types/projectExport';
import type { SurveyDraft } from '../types/surveyDraft';
import {
  getProject,
  getProjectCalculation,
  listProjectCalculations,
} from './projectsApi';

const CALCULATIONS_PAGE_LIMIT = 100;
const CALCULATION_FETCH_CONCURRENCY = 5;

export type FetchProjectExportBundleParams = {
  projectId: string | null;
  localDraft: SurveyDraft;
  localLastCalcInput?: unknown;
  queryClient: QueryClient;
};

/**
 * @param items
 * @param concurrency
 * @param mapper
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) return;
      const item = items[current];
      if (item === undefined) return;
      results[current] = await mapper(item, current);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * @param projectId
 * @param queryClient
 */
async function resolveAllCalculationIds(
  projectId: string,
  queryClient: QueryClient,
): Promise<{ ids: string[]; total: number }> {
  const cacheKey = queryKeys.projectCalculations(projectId);
  const cached = queryClient.getQueryData<CalculationsListResponse>(cacheKey);
  if (
    cached
    && cached.total > 0
    && cached.calculations.length === cached.total
  ) {
    return {
      ids: cached.calculations.map((item) => item.id),
      total: cached.total,
    };
  }

  /** @type {string[]} */
  const ids: string[] = [];
  let skip = 0;
  let total = 0;

  for (;;) {
    const page = await listProjectCalculations(projectId, {
      limit: CALCULATIONS_PAGE_LIMIT,
      skip,
    });
    if (skip === 0) {
      total = page.total;
    }
    ids.push(...page.calculations.map((item) => item.id));
    skip += page.calculations.length;
    if (skip >= total || page.calculations.length === 0) break;
  }

  return { ids, total };
}

/**
 * @param projectId
 * @param calcIds
 */
async function fetchCalculationDetails(
  projectId: string,
  calcIds: string[],
): Promise<CalculationDetail[]> {
  return mapWithConcurrency(calcIds, CALCULATION_FETCH_CONCURRENCY, async (calcId) => {
    const res = await getProjectCalculation(projectId, calcId);
    return res.calculation;
  });
}

/**
 * @param params
 */
export async function fetchProjectExportBundle(
  params: FetchProjectExportBundleParams,
): Promise<ProjectExportBundle> {
  const { projectId, localDraft, localLastCalcInput, queryClient } = params;

  if (projectId == null || projectId.length === 0) {
    return buildSessionOnlyExportBundle(localDraft, localLastCalcInput);
  }

  const projectRes = await getProject(projectId, { includeLastCalculation: true });
  const { ids, total } = await resolveAllCalculationIds(projectId, queryClient);

  if (total > 0 && ids.length !== total) {
    throw new Error(
      `Неповна історія розрахунків: отримано ${String(ids.length)} з ${String(total)}`,
    );
  }

  const calculationDetails =
    ids.length > 0 ? await fetchCalculationDetails(projectId, ids) : [];

  return buildProjectExportBundleFromParts({
    projectId,
    clientName: localDraft.clientName || projectRes.project.clientName,
    ...(projectRes.project.label ? { label: projectRes.project.label } : {}),
    localDraft,
    serverSurvey: projectRes.project.survey,
    serverLastCalcInput: projectRes.project.lastCalcInput,
    ...(localLastCalcInput !== undefined ? { localLastCalcInput } : {}),
    calculationsTotal: total,
    calculationDetails,
  });
}
