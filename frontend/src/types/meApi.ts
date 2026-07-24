/**
 * Назначение: DTO GET /api/v1/me (зеркало OpenAPI MeUser, MeOkResponse).
 */

/** Роль пользователя системы (MongoDB users.role). */
export type UserRole = 'user' | 'admin';

/** Уровень подписки (MongoDB users.subscription). */
export type SubscriptionTier = 'free' | 'pro' | 'marketplace';

/** Провайдер аутентификации (IdP). */
export type MeAuthProvider = 'clerk' | 'auth0';

/** Публичный профиль текущего пользователя. */
export type MeUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  subscription: SubscriptionTier;
  authProvider?: MeAuthProvider;
  name?: string;
  /** true — синтетический dev-профиль без JWT (PROJECTS_AUTH_ENABLED=false). */
  devMode?: boolean;
};

/** Успешный ответ GET /api/v1/me. */
export type MeOkResponse = {
  ok: true;
  user: MeUser;
};
