/**
 * Назначение: strict-парсинг ответа GET /api/v1/me без any.
 */

import type {
  MeAuthProvider,
  MeOkResponse,
  MeUser,
  SubscriptionTier,
  UserRole,
} from '../types/meApi';
import { isRecord } from '../utils/jsonGuards';

const USER_ROLES: readonly UserRole[] = ['user', 'admin'];
const SUBSCRIPTION_TIERS: readonly SubscriptionTier[] = ['free', 'pro', 'marketplace'];
const AUTH_PROVIDERS: readonly MeAuthProvider[] = ['clerk', 'auth0'];

/**
 * @param value
 * @returns {value is UserRole}
 */
function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

/**
 * @param value
 * @returns {value is SubscriptionTier}
 */
function isSubscriptionTier(value: unknown): value is SubscriptionTier {
  return typeof value === 'string' && (SUBSCRIPTION_TIERS as readonly string[]).includes(value);
}

/**
 * @param value
 * @returns {value is MeAuthProvider}
 */
function isMeAuthProvider(value: unknown): value is MeAuthProvider {
  return typeof value === 'string' && (AUTH_PROVIDERS as readonly string[]).includes(value);
}

/**
 * @param node
 * @returns {MeUser}
 */
function parseMeUser(node: unknown): MeUser {
  if (!isRecord(node)) {
    throw new Error('Некоректна відповідь профілю: user');
  }

  const { id, email, emailVerified, role, subscription } = node;

  if (typeof id !== 'string' || !id.trim()) {
    throw new Error('Некоректна відповідь профілю: id');
  }
  if (typeof email !== 'string' || !email.trim()) {
    throw new Error('Некоректна відповідь профілю: email');
  }
  if (typeof emailVerified !== 'boolean') {
    throw new Error('Некоректна відповідь профілю: emailVerified');
  }
  if (!isUserRole(role)) {
    throw new Error('Некоректна відповідь профілю: role');
  }
  if (!isSubscriptionTier(subscription)) {
    throw new Error('Некоректна відповідь профілю: subscription');
  }

  const user: MeUser = {
    id: id.trim(),
    email: email.trim(),
    emailVerified,
    role,
    subscription,
  };

  if ('authProvider' in node && node.authProvider !== undefined) {
    if (!isMeAuthProvider(node.authProvider)) {
      throw new Error('Некоректна відповідь профілю: authProvider');
    }
    user.authProvider = node.authProvider;
  }

  if ('name' in node && node.name !== undefined) {
    if (typeof node.name !== 'string' || !node.name.trim()) {
      throw new Error('Некоректна відповідь профілю: name');
    }
    user.name = node.name.trim();
  }

  if ('devMode' in node && node.devMode !== undefined) {
    if (typeof node.devMode !== 'boolean') {
      throw new Error('Некоректна відповідь профілю: devMode');
    }
    user.devMode = node.devMode;
  }

  return user;
}

/**
 * @param data
 * @returns {MeOkResponse}
 */
export function parseMeOkResponse(data: unknown): MeOkResponse {
  if (!isRecord(data) || data.ok !== true || !('user' in data)) {
    throw new Error('Некоректна відповідь GET /api/v1/me');
  }

  return {
    ok: true,
    user: parseMeUser(data.user),
  };
}
