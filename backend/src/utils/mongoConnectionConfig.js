/**
 * Назначение: конфигурация подключения к MongoDB.
 * Описание: Сборка URI из переменных окружения, нормализация пути БД и список кандидатов для seed и runtime справочников.
 */

/** Таймаут выбора сервера Mongo (мс) — быстрый fallback file при CATALOG_SOURCE=auto. */
const MONGO_SERVER_SELECTION_TIMEOUT_MS = 8_000;

/**
 * @returns {import('mongoose').ConnectOptions}
 */
function defaultMongoConnectOptions() {
  return {
    serverSelectionTimeoutMS: MONGO_SERVER_SELECTION_TIMEOUT_MS,
    connectTimeoutMS: MONGO_SERVER_SELECTION_TIMEOUT_MS,
  };
}

/**
 * @returns {{ authMechanism: string, authSource: string }}
 */
function readMongoAuthEnv() {
  return {
    authMechanism: process.env.MONGODB_AUTH_MECHANISM?.trim() || 'SCRAM-SHA-256',
    authSource: process.env.MONGODB_AUTH_SOURCE?.trim() || 'admin',
  };
}

/**
 * Если в URI нет имени БД (путь пустой или «/»), подставляет MONGODB_DB.
 * @param {string} uri
 * @returns {string}
 */
export function normalizeMongoUri(uri) {
  const trimmed = uri.trim();
  try {
    const url = new URL(trimmed);
    const pathname = url.pathname?.replace(/^\/+|\/+$/g, '') ?? '';
    if (!pathname) {
      const db = process.env.MONGODB_DB?.trim();
      if (!db) {
        throw new Error(
          'MONGODB_URI без имени базы: задайте MONGODB_DB или укажите БД в пути URI',
        );
      }
      url.pathname = `/${db}`;
    }
    if (!url.searchParams.has('retryWrites')) {
      url.searchParams.set('retryWrites', 'true');
    }
    if (!url.searchParams.has('w')) {
      url.searchParams.set('w', 'majority');
    }
    return url.toString();
  } catch (err) {
    if (err instanceof Error && err.message.includes('MONGODB_URI без имени')) {
      throw err;
    }
    return trimmed;
  }
}

/**
 * Все кандидаты подключения MongoDB (для seed: перебор при сбое DNS/сети).
 * @returns {{ uri: string, options: import('mongoose').ConnectOptions, label: string }[]}
 */
export function getMongoConnectionConfigs() {
  const userRaw = process.env.MONGODB_USER?.trim();
  const passRaw = process.env.MONGODB_PASSWORD?.trim();
  const hostRaw = process.env.MONGODB_URL?.trim();
  const dbRaw = process.env.MONGODB_DB?.trim();
  const uriRaw = process.env.MONGODB_URI?.trim();
  const uriFallbackRaw = process.env.MONGODB_URI_FALLBACK?.trim();

  const { authMechanism, authSource } = readMongoAuthEnv();
  const baseOptions = defaultMongoConnectOptions();

  /** @type {{ uri: string, options: import('mongoose').ConnectOptions, label: string }[]} */
  const candidates = [];

  if (uriRaw) {
    candidates.push({
      uri: normalizeMongoUri(uriRaw),
      options: { ...baseOptions },
      label: 'MONGODB_URI',
    });
  }
  if (uriFallbackRaw) {
    candidates.push({
      uri: normalizeMongoUri(uriFallbackRaw),
      options: { ...baseOptions },
      label: 'MONGODB_URI_FALLBACK',
    });
  }
  if (userRaw && passRaw && hostRaw && dbRaw) {
    candidates.push({
      uri: normalizeMongoUri(
        `mongodb+srv://${hostRaw}/${dbRaw}?retryWrites=true&w=majority`,
      ),
      options: {
        ...baseOptions,
        user: userRaw,
        pass: passRaw,
        dbName: dbRaw,
        authMechanism,
        authSource,
      },
      label: 'MONGODB_URL+MONGODB_DB (mongodb+srv)',
    });
  }

  return candidates;
}

/**
 * Первый кандидат подключения или null, если переменные окружения не заданы.
 * @returns {{ uri: string, options: import('mongoose').ConnectOptions } | null}
 */
export function getMongoConnectionConfigOrNull() {
  const candidates = getMongoConnectionConfigs();
  if (candidates.length === 0) return null;
  const first = candidates[0];
  return { uri: first.uri, options: first.options };
}

/**
 * @param {string} envName
 * @param {'file' | 'mongo' | 'auto'} [fallback]
 * @returns {'file' | 'mongo' | 'auto'}
 */
export function resolveReferenceSourceMode(envName, fallback = 'file') {
  const raw = String(process.env[envName] ?? fallback).trim().toLowerCase();
  if (raw === 'mongo') return 'mongo';
  if (raw === 'auto') return 'auto';
  return 'file';
}
