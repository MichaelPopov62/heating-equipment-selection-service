/**
 * Назначение: семафор параллельных PDF-рендеров (защита Node от пика Chromium).
 * Описание: лимит PDF_MAX_CONCURRENT; ожидание слота ограничено PDF_QUEUE_WAIT_MS.
 */

import { createAppError } from '../utils/createAppError.js';

const DEFAULT_QUEUE_WAIT_MS = 15_000;

/**
 * @returns {number}
 */
function maxConcurrent() {
  const n = Number(process.env.PDF_MAX_CONCURRENT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
}

/**
 * Максимальне очікування місця в черзі (мс).
 *
 * @returns {number}
 */
function queueWaitMs() {
  const n = Number(process.env.PDF_QUEUE_WAIT_MS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_QUEUE_WAIT_MS;
}

/**
 * @typedef {{
 *   awaken: () => void,
 *   timer: ReturnType<typeof setTimeout>,
 *   cancelled: boolean,
 * }} PdfQueueWaiter
 */

let active = 0;
/** @type {PdfQueueWaiter[]} */
const waiters = [];

/**
 * @returns {() => void}
 */
function makeRelease() {
  return () => {
    active -= 1;
    const next = waiters.shift();
    if (next) next.awaken();
  };
}

/**
 * Захоплює слот рендера PDF. При переповненні черги — PDF_QUEUE_TIMEOUT (503).
 *
 * @returns {Promise<() => void>} функція release (викликати в finally)
 */
export async function acquirePdfRenderSlot() {
  if (active < maxConcurrent()) {
    active += 1;
    return makeRelease();
  }

  const waitMs = queueWaitMs();

  await new Promise((resolve, reject) => {
    /** @type {PdfQueueWaiter} */
    const waiter = {
      cancelled: false,
      timer: setTimeout(() => {
        waiter.cancelled = true;
        const idx = waiters.indexOf(waiter);
        if (idx >= 0) waiters.splice(idx, 1);
        reject(
          createAppError(
            'Черга PDF переповнена, спробуйте пізніше',
            'PDF_QUEUE_TIMEOUT',
            503,
          ),
        );
      }, waitMs),
      awaken: () => {
        if (waiter.cancelled) return;
        clearTimeout(waiter.timer);
        active += 1;
        resolve(undefined);
      },
    };
    waiters.push(waiter);
  });

  return makeRelease();
}
