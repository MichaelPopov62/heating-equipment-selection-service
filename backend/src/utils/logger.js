/**
 * Назначение: единый логер приложения backend.
 * Описание: Уровни debug/info/warn/error через LOG_LEVEL; префикс с ISO-временем и опциональным requestId.
 */
const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function normalizeLevel(level) {
  const l = String(level ?? '').toLowerCase().trim();
  return Object.prototype.hasOwnProperty.call(LEVELS, l) ? l : 'info';
}

const CURRENT_LEVEL = normalizeLevel(process.env.LOG_LEVEL);

function shouldLog(level) {
  return LEVELS[level] >= LEVELS[CURRENT_LEVEL];
}

function ts() {
  return new Date().toISOString();
}

function formatPrefix(level, meta) {
  const rid = meta?.requestId ? ` rid=${meta.requestId}` : '';
  return `[${level.toUpperCase()}] [${ts()}]${rid}`;
}

export const logger = {
  debug: (msg, meta, ...args) => {
    if (!shouldLog('debug')) return;
    console.debug(`${formatPrefix('debug', meta)} ${msg}`, ...args);
  },
  info: (msg, meta, ...args) => {
    if (!shouldLog('info')) return;
    console.info(`${formatPrefix('info', meta)} ${msg}`, ...args);
  },
  warn: (msg, meta, ...args) => {
    if (!shouldLog('warn')) return;
    console.warn(`${formatPrefix('warn', meta)} ${msg}`, ...args);
  },
  error: (msg, meta, ...args) => {
    if (!shouldLog('error')) return;
    console.error(`${formatPrefix('error', meta)} ${msg}`, ...args);
  },
};

