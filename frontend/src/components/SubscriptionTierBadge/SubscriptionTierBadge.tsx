/**
 * Назначение: badge уровня подписки (tier) из GET /api/v1/me.
 */

import { authUk } from '../../i18n/uk/auth';
import type { SubscriptionTier } from '../../types/meApi';
import styles from './SubscriptionTierBadge.module.css';

export type SubscriptionTierBadgeProps = {
  tier: SubscriptionTier;
  /** Dev-профиль без JWT — подсказка в title. */
  devMode?: boolean;
  className?: string | undefined;
};

const TIER_LABEL: Record<SubscriptionTier, string> = {
  free: authUk.tierFree,
  pro: authUk.tierPro,
  marketplace: authUk.tierMarketplace,
};

/**
 * @param tier
 * @returns {string}
 */
function tierClassName(tier: SubscriptionTier): string {
  if (tier === 'pro') return styles.pro ?? '';
  if (tier === 'marketplace') return styles.marketplace ?? '';
  return styles.free ?? '';
}

/**
 * @param props
 */
export function SubscriptionTierBadge({
  tier,
  devMode = false,
  className,
}: SubscriptionTierBadgeProps) {
  const label = TIER_LABEL[tier];
  const rootClass = className
    ? `${styles.badge} ${tierClassName(tier)} ${className}`
    : `${styles.badge} ${tierClassName(tier)}`;

  return (
    <span
      className={rootClass}
      aria-label={`${authUk.tierBadgeAria}: ${label}`}
      title={devMode ? authUk.tierDevTitle : undefined}
    >
      {label}
    </span>
  );
}
