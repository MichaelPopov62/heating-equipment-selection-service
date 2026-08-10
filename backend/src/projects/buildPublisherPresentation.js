/**
 * Назначение: контакт публикатора для share snapshot (Pro/Marketplace, без gating).
 */

import { isPublisherSubscriptionTier } from '../auth/authorizationPolicy.js';

/**
 * @param {import('../types/auth.js').AuthUser | undefined | null} user
 * @returns {import('../types/shared-types.js').SharePublisherPresentation | undefined}
 */
export function buildPublisherPresentationFromUser(user) {
  if (!user) return undefined;

  const tier = user.subscription;
  if (!isPublisherSubscriptionTier(tier)) {
    return undefined;
  }

  const contactEmail = typeof user.email === 'string' ? user.email.trim() : '';
  if (!contactEmail) {
    return undefined;
  }

  /** @type {import('../types/shared-types.js').SharePublisherPresentation} */
  const presentation = { tier, contactEmail };

  if (typeof user.name === 'string' && user.name.trim()) {
    presentation.contactName = user.name.trim();
  }

  return presentation;
}
