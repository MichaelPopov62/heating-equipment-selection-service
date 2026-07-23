/**
 * Назначение: конфигурация автентификации (prod SaaS).
 */

const AUTH_TOKEN_STORAGE_KEY = 'projectsApiBearerToken';

/** Ключ згоди на cookie. */
export const COOKIE_CONSENT_STORAGE_KEY = 'heatcalc:cookie-consent:v1';

/**
 * @returns {boolean}
 */
export function isAuthRequiredInFrontend(): boolean {
  return import.meta.env.VITE_AUTH_REQUIRED === 'true';
}

/**
 * Clerk publishable key — при наличии включается ClerkProvider и SignIn UI.
 *
 * @returns {string | null}
 */
export function getClerkPublishableKey(): string | null {
  const key = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
  return typeof key === 'string' && key.trim() ? key.trim() : null;
}

/**
 * @returns {boolean}
 */
export function isClerkEnabled(): boolean {
  return getClerkPublishableKey() != null;
}

/**
 * Имя JWT template в Clerk Dashboard (audience = backend AUTH_AUDIENCE).
 *
 * @returns {string | null}
 */
export function getClerkJwtTemplate(): string | null {
  const template = import.meta.env.VITE_CLERK_JWT_TEMPLATE;
  return typeof template === 'string' && template.trim() ? template.trim() : null;
}

/**
 * URL hosted login (Clerk/Auth0). Якщо задано — LoginPage редиректить сюда.
 *
 * @returns {string | null}
 */
export function getAuthLoginUrl(): string | null {
  const url = import.meta.env.VITE_AUTH_LOGIN_URL;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

/**
 * @returns {string | null}
 */
export function readStoredAuthToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)?.trim() || null;
}

/**
 * @param token
 */
export function writeStoredAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token.trim());
}

/**
 * Очистка JWT-сессии.
 */
export function clearStoredAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

/**
 * Декодирование payload JWT без верификации (только UI sub/email).
 *
 * @param token
 * @returns {{ sub: string; email?: string } | null}
 */
export function decodeJwtPayload(token: string): { sub: string; email?: string } | null {
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { sub?: unknown; email?: unknown };
    if (typeof payload.sub !== 'string' || !payload.sub.trim()) return null;
    const result: { sub: string; email?: string } = { sub: payload.sub.trim() };
    if (typeof payload.email === 'string' && payload.email.trim()) {
      result.email = payload.email.trim();
    }
    return result;
  } catch {
    return null;
  }
}
