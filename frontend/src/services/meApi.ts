/**
 * Назначение: HTTP-клиент GET /api/v1/me (профиль текущего пользователя).
 */

import type { MeOkResponse } from '../types/meApi';
import { parseApiErrorMessage } from '../utils/apiError';
import { formatAuthApiErrorMessage } from '../utils/authApiError';
import { getProjectsAuthHeaders } from './projectsAuthHeaders';
import { parseMeOkResponse } from './parseMeResponse';

/** Ошибка запроса профиля с HTTP-статусом (для retry-политики React Query). */
export class MeApiError extends Error {
  readonly statusCode: number;

  /**
   * @param statusCode
   * @param message
   */
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'MeApiError';
    this.statusCode = statusCode;
  }
}

/**
 * @returns {Promise<MeOkResponse>}
 */
export async function fetchMe(): Promise<MeOkResponse> {
  const res = await fetch('/api/v1/me', {
    headers: {
      Accept: 'application/json',
      ...(await getProjectsAuthHeaders()),
    },
  });

  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    throw new MeApiError(
      res.status,
      formatAuthApiErrorMessage(
        parseApiErrorMessage(data, `Помилка API: HTTP ${res.status}`),
      ),
    );
  }

  return parseMeOkResponse(data);
}
