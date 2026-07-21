/**
 * Назначение: семафор параллельных PDF-рендеров (защита Node от пика Chromium).
 */

/**
 * @returns {number}
 */
function maxConcurrent() {
  const n = Number(process.env.PDF_MAX_CONCURRENT);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2;
}

let active = 0;
/** @type {Array<() => void>} */
const waiters = [];

/**
 * @returns {Promise<() => void>}
 */
export async function acquirePdfRenderSlot() {
  if (active < maxConcurrent()) {
    active += 1;
    return () => {
      active -= 1;
      const next = waiters.shift();
      if (next) next();
    };
  }

  await new Promise((resolve) => {
    waiters.push(() => {
      active += 1;
      resolve(undefined);
    });
  });

  return () => {
    active -= 1;
    const next = waiters.shift();
    if (next) next();
  };
}
