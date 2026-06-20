/**
 * Назначение: HTTP-клиент REST API проектов.
 * Описание: CRUD проектов и сохранённых расчётов на backend.
 */

import type {
  CalculationGetResponse,
  CalculationsListResponse,
  ProjectCalcResponse,
  ProjectCreateResponse,
  ProjectGetResponse,
  ProjectsListResponse,
} from '../types/projectsApi';
import type { SurveyDraft } from '../types/surveyDraft';
import { parseApiErrorMessage } from '../utils/apiError';
import { isRecord } from '../utils/jsonGuards';
import { getProjectsAuthHeaders } from './projectsAuthHeaders';

async function parseJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

/** @returns {Record<string, string>} */
function projectsFetchHeaders(extra?: Record<string, string>): Record<string, string> {
  return { Accept: 'application/json', ...getProjectsAuthHeaders(), ...extra };
}

export async function listProjects(params?: {
  search?: string;
  limit?: number;
  skip?: number;
}): Promise<ProjectsListResponse> {
  const q = new URLSearchParams();
  if (params?.search?.trim()) q.set('search', params.search.trim());
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.skip != null) q.set('skip', String(params.skip));
  const qs = q.toString();
  const res = await fetch(`/api/v1/projects${qs ? `?${qs}` : ''}`, {
    headers: projectsFetchHeaders(),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(parseApiErrorMessage(data, `Ошибка API: HTTP ${res.status}`));
  }
  if (!isRecord(data) || data.ok !== true || !Array.isArray(data.projects)) {
    throw new Error('Некорректный ответ списка проектов');
  }
  return data as ProjectsListResponse;
}

export async function createProject(body: {
  clientName: string;
  label?: string;
  survey?: SurveyDraft;
}): Promise<ProjectCreateResponse> {
  const res = await fetch('/api/v1/projects', {
    method: 'POST',
    headers: projectsFetchHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(parseApiErrorMessage(data, `Ошибка API: HTTP ${res.status}`));
  }
  if (!isRecord(data) || data.ok !== true) {
    throw new Error('Некорректный ответ создания проекта');
  }
  return data as ProjectCreateResponse;
}

export async function getProject(
  id: string,
  opts?: { includeLastCalculation?: boolean },
): Promise<ProjectGetResponse> {
  const q = opts?.includeLastCalculation ? '?includeLastCalculation=1' : '';
  const res = await fetch(`/api/v1/projects/${encodeURIComponent(id)}${q}`, {
    headers: projectsFetchHeaders(),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(parseApiErrorMessage(data, `Ошибка API: HTTP ${res.status}`));
  }
  if (!isRecord(data) || data.ok !== true) {
    throw new Error('Некорректный ответ проекта');
  }
  return data as ProjectGetResponse;
}

export async function updateProject(
  id: string,
  body: { clientName?: string; label?: string | null; survey?: SurveyDraft },
): Promise<ProjectGetResponse> {
  const res = await fetch(`/api/v1/projects/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: projectsFetchHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(parseApiErrorMessage(data, `Ошибка API: HTTP ${res.status}`));
  }
  if (!isRecord(data) || data.ok !== true) {
    throw new Error('Некорректный ответ обновления проекта');
  }
  return data as ProjectGetResponse;
}

export async function postProjectCalc(
  projectId: string,
  body: { calcInput: unknown; survey?: SurveyDraft },
): Promise<ProjectCalcResponse> {
  const res = await fetch(`/api/v1/projects/${encodeURIComponent(projectId)}/calc`, {
    method: 'POST',
    headers: projectsFetchHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(parseApiErrorMessage(data, `Ошибка API: HTTP ${res.status}`));
  }
  if (!isRecord(data) || data.ok !== true) {
    throw new Error('Некорректный ответ расчёта проекта');
  }
  return data as ProjectCalcResponse;
}

export async function listProjectCalculations(
  projectId: string,
  params?: { limit?: number; skip?: number },
): Promise<CalculationsListResponse> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.skip != null) q.set('skip', String(params.skip));
  const qs = q.toString();
  const res = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectId)}/calculations${qs ? `?${qs}` : ''}`,
    { headers: projectsFetchHeaders() },
  );
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(parseApiErrorMessage(data, `Ошибка API: HTTP ${res.status}`));
  }
  if (!isRecord(data) || data.ok !== true) {
    throw new Error('Некорректный ответ списка расчётов');
  }
  return data as CalculationsListResponse;
}

export async function getProjectCalculation(
  projectId: string,
  calcId: string,
): Promise<CalculationGetResponse> {
  const res = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectId)}/calculations/${encodeURIComponent(calcId)}`,
    { headers: projectsFetchHeaders() },
  );
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(parseApiErrorMessage(data, `Ошибка API: HTTP ${res.status}`));
  }
  if (!isRecord(data) || data.ok !== true) {
    throw new Error('Некорректный ответ расчёта');
  }
  return data as CalculationGetResponse;
}
