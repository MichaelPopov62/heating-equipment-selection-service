/**
 * Назначение: HTTP-клиент административного API обратной связи.
 */

import type {
  AdminFeedbackListParams,
  AdminFeedbackListResponse,
  AdminFeedbackStatus,
  AdminFeedbackUpdateResponse,
} from '../types/adminFeedback';
import { parseApiErrorMessage } from '../utils/apiError';
import { apiUrl } from '../utils/apiUrl';
import { getProjectsAuthHeaders } from './projectsAuthHeaders';
import {
  parseAdminFeedbackListResponse,
  parseAdminFeedbackUpdateResponse,
} from './parseAdminFeedback';

export class AdminFeedbackApiError extends Error {
  readonly statusCode: number;

  /**
   * @param statusCode
   * @param message
   */
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'AdminFeedbackApiError';
    this.statusCode = statusCode;
  }
}

/**
 * @param response
 */
async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

/**
 * @param response
 * @param data
 */
function throwApiError(response: Response, data: unknown): never {
  throw new AdminFeedbackApiError(
    response.status,
    parseApiErrorMessage(data, `Помилка API: HTTP ${response.status}`),
  );
}

/**
 * @param params
 */
export async function listAdminFeedback(
  params: AdminFeedbackListParams,
): Promise<AdminFeedbackListResponse> {
  const query = new URLSearchParams({ limit: String(params.limit) });
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.status) query.set('status', params.status);
  if (params.type) query.set('type', params.type);

  const response = await fetch(apiUrl(`/api/v1/admin/feedback?${query.toString()}`), {
    headers: {
      Accept: 'application/json',
      ...(await getProjectsAuthHeaders()),
    },
  });
  const data = await readJson(response);
  if (!response.ok) throwApiError(response, data);
  return parseAdminFeedbackListResponse(data);
}

/**
 * @param id
 * @param status
 */
export async function updateAdminFeedbackStatus(
  id: string,
  status: AdminFeedbackStatus,
): Promise<AdminFeedbackUpdateResponse> {
  const response = await fetch(apiUrl(`/api/v1/admin/feedback/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(await getProjectsAuthHeaders()),
    },
    body: JSON.stringify({ status }),
  });
  const data = await readJson(response);
  if (!response.ok) throwApiError(response, data);
  return parseAdminFeedbackUpdateResponse(data);
}
