/**
 * Назначение: rate limiting для calc и projects API.
 * Описание: Ключ — sub пользователя или IP; в dev отключается через RATE_LIMIT_DISABLED.
 */

import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { isRateLimitDisabled } from '../../auth/projectsAuthConfig.js';

/**
 * @param {import('express').Request} req
 * @returns {string}
 */
function rateLimitKey(req) {
  const sub = req.projectsUser?.sub;
  if (typeof sub === 'string' && sub.trim()) {
    return `user:${sub.trim()}`;
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
    keyGenerator: rateLimitKey,
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
 * @returns {number}
 */
function envLimit(name, fallback) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Лимит stateless POST /api/v1/calc */
export const calcRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: envLimit('RATE_LIMIT_CALC_PER_15M', 20),
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
