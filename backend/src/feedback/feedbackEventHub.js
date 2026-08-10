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
 * @param {import('../types/shared-types.js').FeedbackCreatedEvent} event
 * @returns {void}
 */
export function publishFeedbackEvent(event) {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch (err) {
      // Ошибка одного SSE-клиента не должна мешать доставке остальным.
      logger.warn(
        'feedbackEventHub.sse.listener_error',
        null,
        {
          message: err instanceof Error ? err.message : String(err),
        },
        err,
      );
    }
  }
}

/**
 * @returns {number}
 */
export function feedbackEventSubscriberCount() {
  return listeners.size;
}
