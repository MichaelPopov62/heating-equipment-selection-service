/**
 * Назначение: in-memory fan-out событий feedback для одного процесса API.
 */

import { logger } from '../utils/logger.js';

/** @type {Set<import('../types/shared-types.js').FeedbackEventListener>} */
const listeners = new Set();

/**
 * @param {import('../types/shared-types.js').FeedbackEventListener} listener
 * @returns {() => void}
 */
export function subscribeFeedbackEvents(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Метадані події для логів без PII (як feedback.created).
 *
 * @param {import('../types/shared-types.js').FeedbackCreatedEvent} event
 * @returns {{ event?: string, feedbackId?: string, type?: string, hasEmail: boolean }}
 */
function feedbackEventLogMeta(event) {
  const fb =
    event && typeof event === 'object' && event.feedback && typeof event.feedback === 'object'
      ? event.feedback
      : null;
  return {
    ...(typeof event?.event === 'string' ? { event: event.event } : {}),
    ...(fb && typeof fb.id === 'string' ? { feedbackId: fb.id } : {}),
    ...(fb && typeof fb.type === 'string' ? { type: fb.type } : {}),
    hasEmail: Boolean(fb && typeof fb.email === 'string' && fb.email.trim()),
  };
}

/**
 * @param {import('../types/shared-types.js').FeedbackCreatedEvent} event
 * @returns {void}
 */
export function publishFeedbackEvent(event) {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch (err) {
      // Ошибка одного SSE-клиента не должна мешать доставке остальным.
      // Payload (email/message) у лог не кладемо — лише метадані.
      logger.warn('feedbackEventHub.sse.listener_error', null, {
        ...feedbackEventLogMeta(event),
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * @returns {number}
 */
export function feedbackEventSubscriberCount() {
  return listeners.size;
}
