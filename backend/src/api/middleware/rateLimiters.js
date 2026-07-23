/**
 * Назначение: rate limiting для calc и projects API.
 * Описание: Ключ — users._id (req.user.id) или IP; в dev отключается через RATE_LIMIT_DISABLED.
 */

import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { isRateLimitDisabled } from '../../auth/projectsAuthConfig.js';

/**
 * @param {import('express').Request} req
 * @returns {string}
 */
export function resolveRateLimitKey(req) {
  const userId = req.user?.id;
  if (typeof userId === 'string' && userId.trim()) {
    return `user:${userId.trim()}`;
  }
  return ipKeyGenerator(req.ip ?? '127.0.0.1');
}

/**
 * @param {{ windowMs: number, max: number, code?: string }} opts
 * @returns {import('express').RequestHandler}
 */
function createLimiter(opts) {
  if (isRateLimitDisabled()) {
    /**
     * @param {import('express').Request} _req
     * @param {import('express').Response} _res
     * @param {import('express').NextFunction} next
     */
    return (_req, _res, next) => next();
  }

  const code = opts.code ?? 'RATE_LIMIT_EXCEEDED';

  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: resolveRateLimitKey,
    handler: (_req, res) => {
      res.status(429).json({
        ok: false,
        error: {
          message: 'Слишком много запросов',
          code,
          statusCode: 429,
        },
      });
    },
  });
}

/**
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
function envLimit(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Дефолт calc-лимита: в dev выше, чтобы автопересчёт анкеты не упирался в 429 при заполнении. */
function defaultCalcRateLimitPer15m() {
  return process.env.NODE_ENV === 'production' ? 20 : 120;
}

/** Лимит stateless POST /api/v1/calc */
export const calcRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: envLimit('RATE_LIMIT_CALC_PER_15M', defaultCalcRateLimitPer15m()),
  code: 'CALC_RATE_LIMIT_EXCEEDED',
});

/** Лимит POST .../projects/:id/calc */
export const projectCalcRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: envLimit('RATE_LIMIT_PROJECT_CALC_PER_15M', 15),
  code: 'PROJECT_CALC_RATE_LIMIT_EXCEEDED',
});

/** Лимит записи projects (POST/PUT/DELETE) */
export const projectsWriteRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: envLimit('RATE_LIMIT_PROJECTS_WRITE_PER_15M', 60),
});

/** Лимит чтения projects (GET) */
export const projectsReadRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: envLimit('RATE_LIMIT_PROJECTS_READ_PER_15M', 120),
});

/**
 * Публичные share GET — только IP (без JWT).
 * @returns {import('express').RequestHandler}
 */
export const publicShareReadRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: envLimit('RATE_LIMIT_PUBLIC_SHARE_PER_15M', 120),
  code: 'PUBLIC_SHARE_RATE_LIMIT_EXCEEDED',
});

/** POST /api/v1/feedback — bug/contact формы футера. */
export const feedbackRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: envLimit('RATE_LIMIT_FEEDBACK_PER_15M', 20),
  code: 'FEEDBACK_RATE_LIMIT_EXCEEDED',
});
