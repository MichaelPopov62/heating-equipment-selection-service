/**
 * Назначение: HTTP-клиент feedback API (prod SaaS).
 */

import { getProjectsAuthHeaders } from './projectsAuthHeaders';

export type FeedbackType = 'bug' | 'contact';

export type FeedbackPayload = {
  type: FeedbackType;
  message: string;
  email?: string;
  name?: string;
  pageUrl?: string;
  appVersion?: string;
  buildId?: string;
};

export type FeedbackOkResponse = {
  ok: true;
  id: string;
};

/**
 * @param payload
 * @returns {Promise<FeedbackOkResponse>}
 */
export async function submitFeedback(payload: FeedbackPayload): Promise<FeedbackOkResponse> {
  const res = await fetch('/api/v1/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(await getProjectsAuthHeaders()),
    },
    body: JSON.stringify(payload),
  });

  const data: unknown = await res.json();
  if (!res.ok) {
    const msg =
      data &&
      typeof data === 'object' &&
      'error' in data &&
      data.error &&
      typeof data.error === 'object' &&
      'message' in data.error &&
      typeof data.error.message === 'string'
        ? data.error.message
        : 'Не вдалося надіслати повідомлення';
    throw new Error(msg);
  }

  if (
    !data ||
    typeof data !== 'object' ||
    !('ok' in data) ||
    data.ok !== true ||
    !('id' in data) ||
    typeof data.id !== 'string'
  ) {
    throw new Error('Некоректна відповідь сервера');
  }

  return { ok: true, id: data.id };
}
