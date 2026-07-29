/**
 * Назначение: in-memory fan-out событий feedback для одного процесса API.
 */

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
    } catch {
      // Ошибка одного SSE-клиента не должна мешать доставке остальным.
    }
  }
}

/**
 * @returns {number}
 */
export function feedbackEventSubscriberCount() {
  return listeners.size;
}
