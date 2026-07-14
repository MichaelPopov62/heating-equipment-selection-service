/**
 * Назначение: единый логер приложения backend.
 * Описание: Уровни debug/info/warn/error через LOG_LEVEL; префикс с ISO-временем и опциональным requestId.
 */

/** @typedef {'debug' | 'info' | 'warn' | 'error'} LogLevel */

/** @type {Record<LogLevel, number>} */
const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * @param {unknown} level
 * @returns {LogLevel}
 */
function normalizeLevel(level) {
  const l = String(level ?? '').toLowerCase().trim();
  return Object.prototype.hasOwnProperty.call(LEVELS, l) ? /** @type {LogLevel} */ (l) : 'info';
}

const CURRENT_LEVEL = normalizeLevel(process.env.LOG_LEVEL);

/**
 * @param {LogLevel} level
 * @returns {boolean}
 */
function shouldLog(level) {
  return LEVELS[level] >= LEVELS[CURRENT_LEVEL];
}

/**
 * @returns {string}
 */
function ts() {
  return new Date().toISOString();
}

/**
 * @param {LogLevel} level
 * @param {{ requestId?: string } | null | undefined} meta
 * @returns {string}
 */
function formatPrefix(level, meta) {
  const rid = meta?.requestId ? ` rid=${meta.requestId}` : '';
  return `[${level.toUpperCase()}] [${ts()}]${rid}`;
}

/** @typedef {{ requestId?: string } | null | undefined} LoggerMeta */

/**
 * @param {LogLevel} level
 * @param {(line: string, ...args: unknown[]) => void} write
 * @returns {(msg: string, meta?: LoggerMeta, ...args: unknown[]) => void}
 */
function makeLogFn(level, write) {
  return (msg, meta, ...args) => {
    if (!shouldLog(level)) return;
    write(`${formatPrefix(level, meta)} ${msg}`, ...args);
  };
}

export const logger = {
  debug: makeLogFn('debug', (...args) => { console.debug(...args); }),
  info: makeLogFn('info', (...args) => { console.info(...args); }),
  warn: makeLogFn('warn', (...args) => { console.warn(...args); }),
  error: makeLogFn('error', (...args) => { console.error(...args); }),
};
