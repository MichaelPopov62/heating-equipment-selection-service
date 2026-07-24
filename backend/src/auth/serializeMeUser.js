/**
 * Назначение: сериализация AuthUser → MeUser (GET /api/v1/me).
 */

import { resolveProjectsDevOwnerObjectId } from './projectsAuthConfig.js';

/**
 * @param {import('../types/auth.js').AuthUser} user
 * @returns {import('../types/auth.js').MeUser}
 */
export function serializeMeUser(user) {
  /** @type {import('../types/auth.js').MeUser} */
  const me = {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    role: user.role,
    subscription: user.subscription,
    authProvider: user.authProvider,
  };
  if (user.name) {
    me.name = user.name;
  }
  return me;
}

/**
 * Dev-профиль без JWT (PROJECTS_AUTH_ENABLED=false).
 *
 * @returns {import('../types/auth.js').MeUser}
 */
export function buildDevMeUser() {
  return {
    id: String(resolveProjectsDevOwnerObjectId()),
    email: 'dev-local@localhost',
    emailVerified: false,
    role: 'user',
    subscription: 'free',
    devMode: true,
  };
}
