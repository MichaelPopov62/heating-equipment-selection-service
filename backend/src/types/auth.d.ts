/**
 * @file Контракты аутентификации (Фаза 1–2): JWT identity vs system user.
 * SSOT для AuthIdentity, AuthUser и RequestContext.
 */

/** Провайдер аутентификации (IdP). */
export type AuthProvider = 'clerk' | 'auth0';

/** Роль пользователя системы (Фаза 2). */
export type UserRole = 'user' | 'admin';

/** Уровень подписки (Фаза 2; без quota-gates на calc/share/PDF). */
export type SubscriptionTier = 'free' | 'pro' | 'marketplace';

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
  role: UserRole;
  subscription: SubscriptionTier;
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

/** Публичный профиль GET /api/v1/me. */
export interface MeUser {
  id: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  subscription: SubscriptionTier;
  authProvider?: AuthProvider;
  name?: string;
  /** true — dev без PROJECTS_AUTH_ENABLED (синтетический профиль). */
  devMode?: boolean;
}

/** Ответ GET /api/v1/me. */
export interface MeOkResponse {
  ok: true;
  user: MeUser;
}

/** Тело PATCH /api/v1/admin/users/{id}. */
export interface AdminUserPatchBody {
  role?: UserRole;
  subscription?: SubscriptionTier;
}

/** Ответ PATCH /api/v1/admin/users/{id}. */
export interface AdminUserPatchResponse {
  ok: true;
  user: MeUser;
}
