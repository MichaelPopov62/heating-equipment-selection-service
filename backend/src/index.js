/**
 * Назначение: точка входа HTTP-сервера.
 * Описание: Загружает переменные окружения из backend/.env, поднимает Express с CORS, Helmet (security headers), trust proxy и middleware requestId/логирования. Подключает роуты из api/public.js и прогревает кэш справочников reference/public.js. Обрабатывает ошибки и возвращает структурированный JSON.
 */

import { config as loadEnv } from 'dotenv';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import helmet from 'helmet';
import { createRoutes } from './api/public.js';
import { warmupReferenceCache } from './reference/public.js';
import { assertProjectsAuthConfiguredForProduction } from './auth/projectsAuthConfig.js';
import { isMongoBsonObjectTooLargeError } from './projects/documentSizeLimits.js';
import { logger } from './utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '.env') });

assertProjectsAuthConfiguredForProduction();
if (process.exitCode === 1) {
  process.exit(1);
}

const PORT = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === 'production';

const app = express();

// За reverse proxy (nginx, Traefik): req.secure и HSTS в production
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy === 'true' || trustProxy === '1') {
  app.set('trust proxy', 1);
} else if (trustProxy && /^\d+$/.test(trustProxy)) {
  app.set('trust proxy', Number(trustProxy));
} else if (isProduction) {
  app.set('trust proxy', 1);
}

// CORS: dev — Vite (5173); prod — только CORS_ORIGIN (same-origin /api через nginx не требует CORS)
const defaultCorsOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
/** @type {string[]} */
const corsOrigins =
  typeof process.env.CORS_ORIGIN === 'string' && process.env.CORS_ORIGIN.trim()
    ? process.env.CORS_ORIGIN.split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : isProduction
      ? []
      : defaultCorsOrigins;

app.use(
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-System-Token'],
    maxAge: 86400,
  }),
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
    hsts: isProduction
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
      : false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

// requestId + базове логування (api.request/api.response) для кожного HTTP-запиту
/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
app.use((req, res, next) => {
  const requestId = randomUUID();
  req.requestId = requestId;

  const startedAt = Date.now();
  const method = String(req.method ?? 'GET').toUpperCase();
  const path = req.path ?? '/';

  logger.info('api.request', { requestId }, { method, path });

  res.on('finish', () => {
    const ms = Date.now() - startedAt;
    logger.info('api.response', { requestId }, { method, path, statusCode: res.statusCode, ms });
  });

  next();
});

// JSON body-parser із лімітом payload (відповідає попередньому maxBytes)
app.use(express.json({ limit: '1mb' }));

// Роути API
const routes = await createRoutes();
app.use(routes);

const blockStartupWarmup =
  process.env.REFERENCE_WARMUP_BLOCK_STARTUP === 'true' ||
  process.env.REFERENCE_WARMUP_BLOCK_STARTUP === '1';

/**
 * Прогрев reference bundle. Коалесцируется с getReferenceBundle() через refreshInFlight в configCache.
 * @returns {Promise<void>}
 */
async function runReferenceCacheWarmup() {
  logger.info('referenceCache.warmup.start', null, { blocking: blockStartupWarmup });
  try {
    const bundle = await warmupReferenceCache();
    logger.info('referenceCache.warmup.ok', null, {
      loadedAt: new Date(bundle.loadedAt).toISOString(),
      catalogSource: bundle.catalogSource,
    });
  } catch (err) {
    logger.error('referenceCache.warmup.failed', null, {
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// Прогрев до listen: раньше старт, без гонки с первым calc; по умолчанию не блокирует bind порта
if (blockStartupWarmup) {
  try {
    await runReferenceCacheWarmup();
  } catch {
    process.exit(1);
  }
} else {
  void runReferenceCacheWarmup().catch(() => {
    /* referenceCache.warmup.failed уже залогирован */
  });
}

// Централізований обробник помилок у форматі ErrorEnvelope (ok=false)
/**
 * @param {import('./types/shared-types').AppErrorLike} err
 * @param {import('express').Request} req
 * @param {import('express').Response<import('./types/shared-types').ErrorEnvelope>} res
 * @param {import('express').NextFunction} _next
 */
app.use((err, req, res, _next) => {
  const requestId = req.requestId ?? null;
  const method = String(req.method ?? 'GET').toUpperCase();
  const path = req.path ?? '/';

  let statusCode = err?.statusCode ?? err?.status ?? 500;
  let code = err?.code ?? 'ERR';
  let clientMessage =
    statusCode >= 500 ? 'Внутренняя ошибка сервера' : err?.message ?? 'Ошибка запроса';
  /** @type {import('./types/shared-types').ErrorDetailsAjvItem[] | undefined} */
  const details =
    statusCode >= 500
      ? undefined
      : (Array.isArray(err?.details) ? err.details : undefined);

  // Помилки парсингу JSON / надто великий payload від express.json()
  if (err && typeof err === 'object') {
    if (err.type === 'entity.too.large') {
      statusCode = 413;
      code = 'PAYLOAD_TOO_LARGE';
      clientMessage = 'Слишком большой запрос';
    } else if (err instanceof SyntaxError && 'body' in err) {
      statusCode = 400;
      code = 'BAD_JSON';
      clientMessage = 'Некорректный JSON';
    } else if (isMongoBsonObjectTooLargeError(err)) {
      statusCode = 413;
      code = 'CALCULATION_DOCUMENT_TOO_LARGE';
      clientMessage = 'Документ расчёта слишком большой для сохранения';
    }
  }

  /** @type {Record<string, unknown>} */
  const errorLog = { method, path, statusCode, code, clientMessage };
  if (statusCode >= 500 && err instanceof Error) {
    errorLog.internalMessage = err.message;
    errorLog.stack = err.stack;
  } else {
    errorLog.message = clientMessage;
  }

  logger.error('api.error', { requestId }, errorLog);

  res.status(statusCode).json({
    ok: false,
    error: { message: clientMessage, code, statusCode, details },
  });
});

const server = app.listen(PORT, () => {
  process.stdout.write(`API запущен на порту ${PORT}\n`);
  // Не через logger: при LOG_LEVEL=warn|error сообщения info не видны.
  process.stdout.write(
    'Валидация анкеты: room.type — strict enum; legacy/synonym с warning; coerceTypes: false.\n',
  );
});

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    process.stderr.write(`Порт ${PORT} уже занят. Освободите порт и перезапустите.\n`);
    process.exitCode = 1;
    return;
  }

  process.stderr.write(`Ошибка сервера: ${err?.message ?? String(err)}\n`);
  process.exitCode = 1;
});
