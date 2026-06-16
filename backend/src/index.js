/**
 * Назначение: точка входа HTTP-сервера.
 * Описание: Загружает переменные окружения из backend/.env, поднимает Express с CORS и middleware requestId/логирования. Подключает роуты из api/public.js и прогревает кэш справочников reference/public.js. Обрабатывает ошибки и возвращает структурированный JSON.
 */

import { config as loadEnv } from 'dotenv';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { createRoutes } from './api/public.js';
import { warmupReferenceCache } from './reference/public.js';
import { logger } from './utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(__dirname, '..', '.env') });

const PORT = Number(process.env.PORT || 3001);

const app = express();

// CORS: фронт на Vite (5173) и др. — список через CORS_ORIGIN в .env (через запятую)
const defaultCorsOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const corsOrigins =
  typeof process.env.CORS_ORIGIN === 'string' && process.env.CORS_ORIGIN.trim()
    ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
    : defaultCorsOrigins;
app.use(cors({ origin: corsOrigins }));

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

// Роути API; прогрев справочников — в фоне после listen (не блокирует порт при долгом Mongo)
const routes = await createRoutes();
app.use(routes);

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
  let message =
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
      message = 'Слишком большой запрос';
    } else if (err instanceof SyntaxError && 'body' in err) {
      statusCode = 400;
      code = 'BAD_JSON';
      message = 'Некорректный JSON';
    }
  }

  logger.error('api.error', { requestId }, { method, path, statusCode, code, message });

  res.status(statusCode).json({
    ok: false,
    error: { message, code, statusCode, details },
  });
});

const server = app.listen(PORT, () => {
  process.stdout.write(`API запущен на порту ${PORT}\n`);
  // Не через logger: при LOG_LEVEL=warn|error сообщения info не видны.
  process.stdout.write(
    'Валидация анкеты: room.type — нормализация (прихожая, кухня, …), не старый enum жилое/living.\n',
  );
  void warmupReferenceCache().catch((err) => {
    logger.error('referenceCache.warmup.failed', null, {
      message: err instanceof Error ? err.message : String(err),
    });
  });
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
