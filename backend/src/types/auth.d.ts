/**
 * @file Контракты аутентификации (Фаза 1): JWT identity vs system user.
 * SSOT для AuthIdentity, AuthUser и RequestContext.
 */

/** Провайдер аутентификации (IdP). */
export type AuthProvider = 'clerk' | 'auth0';

/**
 * Идентичность из cryptographically verified JWT.
 * Источник истины — только payload после jose.jwtVerify(); без Mongo и defaults.
 */
export interface AuthIdentity {
  /** IdP, определённый из env (AUTH_PROVIDER) или registry по iss. */
  provider: AuthProvider;
  /** JWT claim sub — ключ поиска User в MongoDB. */
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

/**
 * Пользователь системы после resolveUser() — документ MongoDB users.
 * Единый контракт для controllers/services (req.user).
 */
export interface AuthUser {
  /** users._id (string). */
  id: string;
  authProvider: AuthProvider;
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  /** Default 'user' в фазе 1; authorization logic — фаза 2. */
  role: string;
  /** Default 'free' в фазе 1; subscription gates — фаза 2. */
  subscription: string;
}

/**
 * Контекст запроса после attachRequestContext() (фаза 1 auth middleware).
 */
export interface RequestContext {
  requestId: string;
  ip: string;
  userAgent: string;
  user: AuthUser;
}

/** Режим проверки JWT на backend (взаимоисключающие). */
export type AuthJwtMode = 'jwks' | 'hs256';

/** Результат валидации auth-конфигурации при старте. */
export interface AuthConfigValidationResult {
  ok: boolean;
  mode: AuthJwtMode | null;
  errors: string[];
}
