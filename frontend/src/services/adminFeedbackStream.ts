/**
 * Назначение: fetch-подписка на SSE admin feedback с Bearer-заголовком.
 */

import type { AdminFeedbackItem } from '../types/adminFeedback';
import { getProjectsAuthHeaders } from './projectsAuthHeaders';
import { AdminFeedbackApiError } from './adminFeedbackApi';
import { parseAdminFeedbackItem } from './parseAdminFeedback';

export type AdminFeedbackStreamOptions = {
  signal: AbortSignal;
  onOpen: () => void;
  onCreated: (item: AdminFeedbackItem) => void;
};

/**
 * Разбирает завершённый SSE-блок. Комментарии heartbeat и неизвестные события игнорируются.
 *
 * @param block
 * @param onCreated
 */
function processSseBlock(block: string, onCreated: (item: AdminFeedbackItem) => void): void {
  let eventName = '';
  const dataLines: string[] = [];

  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) continue;
    const separator = line.indexOf(':');
    const field = separator < 0 ? line : line.slice(0, separator);
    const rawValue = separator < 0 ? '' : line.slice(separator + 1);
    const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;
    if (field === 'event') eventName = value;
    if (field === 'data') dataLines.push(value);
  }

  if (eventName !== 'feedback.created' || dataLines.length === 0) return;
  const data: unknown = JSON.parse(dataLines.join('\n'));
  onCreated(parseAdminFeedbackItem(data));
}

/**
 * Открывает одну SSE-сессию и завершается при disconnect или abort.
 *
 * @param options
 */
export async function streamAdminFeedback(options: AdminFeedbackStreamOptions): Promise<void> {
  const response = await fetch('/api/v1/admin/feedback/stream', {
    headers: {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
      ...(await getProjectsAuthHeaders()),
    },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new AdminFeedbackApiError(
      response.status,
      `Не вдалося підключити live-оновлення: HTTP ${response.status}`,
    );
  }
  if (!response.body) {
    throw new Error('Браузер не надав потік live-оновлень');
  }

  options.onOpen();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (!options.signal.aborted) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    buffer = buffer.replaceAll('\r\n', '\n');

    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      processSseBlock(block, options.onCreated);
      boundary = buffer.indexOf('\n\n');
    }
  }

  options.signal.throwIfAborted();
}
