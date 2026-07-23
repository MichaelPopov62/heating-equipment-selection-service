/**
 * Назначение: извлечение Bearer JWT из заголовка Authorization.
 */

/**
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function extractBearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header.trim());
  return match?.[1] ?? null;
}
