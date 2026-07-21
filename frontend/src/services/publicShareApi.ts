/**
 * Назначение: HTTP-клиент публичных share-ссылок (без JWT).
 */

import type { PublicShareResponse } from '../types/projectsApi';
import { parseApiErrorMessage } from '../utils/apiError';
import {
  downloadBlobFile,
  filenameFromContentDisposition,
} from '../utils/downloadBlobFile';
import { isRecord } from '../utils/jsonGuards';

async function parseJson(res: Response): Promise<unknown> {
  return res.json().catch(() => null);
}

/**
 * @param shareToken
 */
export async function fetchPublicShare(shareToken: string): Promise<PublicShareResponse> {
  const res = await fetch(`/api/v1/public/shares/${encodeURIComponent(shareToken)}`, {
    headers: { Accept: 'application/json' },
  });
  const data = await parseJson(res);
  if (!res.ok) {
    throw new Error(parseApiErrorMessage(data, `Ошибка API: HTTP ${res.status}`));
  }
  if (!isRecord(data) || data.ok !== true || !isRecord(data.share)) {
    throw new Error('Некорректный ответ публичной ссылки');
  }
  return data as PublicShareResponse;
}

/**
 * Скачать PDF публичной сметы (без JWT).
 *
 * @param shareToken
 * @param opts
 */
export async function downloadPublicSharePdf(
  shareToken: string,
  opts?: { includeTechnical?: boolean },
): Promise<void> {
  const q = new URLSearchParams();
  if (opts?.includeTechnical) q.set('includeTechnical', '1');
  const qs = q.toString();
  const res = await fetch(
    `/api/v1/public/shares/${encodeURIComponent(shareToken)}/pdf${qs ? `?${qs}` : ''}`,
    { headers: { Accept: 'application/pdf' } },
  );
  if (!res.ok) {
    const data = await parseJson(res);
    throw new Error(parseApiErrorMessage(data, `Не удалось скачать PDF: HTTP ${res.status}`));
  }
  const blob = await res.blob();
  const filename = filenameFromContentDisposition(
    res.headers.get('Content-Disposition'),
    'Смета.pdf',
  );
  downloadBlobFile(blob, filename);
}
