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
  ProjectSharePublishResponse,
  ProjectShareRevokeResponse,
  ProjectsListResponse,
} from '../types/projectsApi';
import type { SurveyDraft } from '../types/surveyDraft';
import { parseApiErrorMessage } from '../utils/apiError';
import {
  downloadBlobFile,
  filenameFromContentDisposition,
} from '../utils/downloadBlobFile';
import { isRecord } from '../utils/jsonGuards';
import { getProjectsAuthHeaders } from './projectsAuthHeaders';

async function parseJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

/** @returns {Promise<Record<string, string>>} */
async function projectsFetchHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  return { Accept: 'application/json', ...(await getProjectsAuthHeaders()), ...extra };
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
    headers: await projectsFetchHeaders(),
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
    headers: await projectsFetchHeaders({ 'Content-Type': 'application/json' }),
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
    headers: await projectsFetchHeaders(),
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
    headers: await projectsFetchHeaders({ 'Content-Type': 'application/json' }),
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
    headers: await projectsFetchHeaders({ 'Content-Type': 'application/json' }),
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
    { headers: await projectsFetchHeaders() },
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
    { headers: await projectsFetchHeaders() },
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

/**
 * Публикация / обновление публичной ссылки (owner JWT).
 *
 * @param projectId
 * @param body
 */
export async function publishProjectShare(
  projectId: string,
  body?: { calculationId?: string },
): Promise<ProjectSharePublishResponse> {
  const res = await fetch(`/api/v1/projects/${encodeURIComponent(projectId)}/share`, {
    method: 'POST',
    headers: await projectsFetchHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body ?? {}),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(parseApiErrorMessage(data, `Ошибка API: HTTP ${res.status}`));
  }
  if (!isRecord(data) || data.ok !== true || typeof data.shareToken !== 'string') {
    throw new Error('Некорректный ответ публикации ссылки');
  }
  return data as ProjectSharePublishResponse;
}

/**
 * Отзыв публичной ссылки.
 *
 * @param projectId
 */
export async function revokeProjectShare(
  projectId: string,
): Promise<ProjectShareRevokeResponse> {
  const res = await fetch(`/api/v1/projects/${encodeURIComponent(projectId)}/share`, {
    method: 'DELETE',
    headers: await projectsFetchHeaders(),
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(parseApiErrorMessage(data, `Ошибка API: HTTP ${res.status}`));
  }
  if (!isRecord(data) || data.ok !== true) {
    throw new Error('Некорректный ответ отзыва ссылки');
  }
  return data as ProjectShareRevokeResponse;
}

/**
 * Скачать PDF сметы проекта (серверная генерация).
 *
 * @param projectId
 * @param opts
 */
export async function downloadProjectPdf(
  projectId: string,
  opts?: { includeTechnical?: boolean },
): Promise<void> {
  const q = new URLSearchParams();
  if (opts?.includeTechnical) q.set('includeTechnical', '1');
  const qs = q.toString();
  const res = await fetch(
    `/api/v1/projects/${encodeURIComponent(projectId)}/pdf${qs ? `?${qs}` : ''}`,
    { headers: await projectsFetchHeaders({ Accept: 'application/pdf' }) },
  );
  if (!res.ok) {
    const data = await parseJson(res);
    throw new Error(parseApiErrorMessage(data, `Не удалось скачать PDF: HTTP ${res.status}`));
  }
  const blob = await res.blob();
  const filename = filenameFromContentDisposition(
    res.headers.get('Content-Disposition'),
    `Смета_${projectId}.pdf`,
  );
  downloadBlobFile(blob, filename);
}
