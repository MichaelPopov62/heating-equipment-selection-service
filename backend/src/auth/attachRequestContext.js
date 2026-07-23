/**
 * Назначение: прикрепление AuthUser и метаданных запроса к Express Request.
 * Описание: req.user — единый контракт для controllers; requestId задаётся глобально в index.js.
 */

/**
 * @param {import('express').Request} req
 * @returns {string}
 */
function resolveClientIp(req) {
  if (typeof req.ip === 'string' && req.ip.trim()) {
    return req.ip.trim();
  }
  const socketAddr = req.socket?.remoteAddress;
  if (typeof socketAddr === 'string' && socketAddr.trim()) {
    return socketAddr.trim();
  }
  return '';
}

/**
 * @param {import('express').Request} req
 * @returns {string}
 */
function resolveUserAgent(req) {
  const header = req.get('user-agent');
  return typeof header === 'string' ? header : '';
}

/**
 * @param {import('express').Request} req
 * @param {import('../types/auth.js').AuthUser} user
 * @returns {import('../types/auth.js').RequestContext}
 */
export function attachRequestContext(req, user) {
  req.user = user;

  return {
    requestId: req.requestId ?? '',
    ip: resolveClientIp(req),
    userAgent: resolveUserAgent(req),
    user,
  };
}
