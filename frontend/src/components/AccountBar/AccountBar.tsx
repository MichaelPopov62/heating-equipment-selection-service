/**
 * Назначение: единая панель сессии — «Увійти», email, tier badge, logout.
 * Профиль tier/email — только из GET /api/v1/me (не JWT decode).
 */

import { Link, useLocation } from 'react-router';

import { useAuth } from '../../auth/useAuth';
import { adminFeedbackUk } from '../../i18n/uk/adminFeedback';
import { authUk } from '../../i18n/uk/auth';
import { useMeQuery } from '../../query/queries/useMeQuery';
import { MeApiError } from '../../services/meApi';
import { paths } from '../../routing/paths';
import { SubscriptionTierBadge } from '../SubscriptionTierBadge/SubscriptionTierBadge';
import styles from './AccountBar.module.css';

export type AccountBarProps = {
  className?: string | undefined;
  /** Компактный вид для шапки анкеты. */
  compact?: boolean;
};

/**
 * @param error
 * @returns {boolean}
 */
function isUnauthorizedMeError(error: Error | null): boolean {
  return error instanceof MeApiError && error.statusCode === 401;
}

/**
 * @param props
 */
export function AccountBar({ className, compact = false }: AccountBarProps) {
  const { isAuthenticated, isAuthRequired, logout } = useAuth();
  const { user: meUser, meLoading, meError } = useMeQuery();
  const location = useLocation();

  const loginTo = `${paths.login}?returnTo=${encodeURIComponent(
    `${location.pathname}${location.search}`,
  )}`;

  const rootClass = [
    styles.bar,
    compact ? styles.compact : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const showLogin =
    (isAuthRequired && !isAuthenticated) ||
    (isAuthRequired && isAuthenticated && isUnauthorizedMeError(meError));

  if (showLogin) {
    return (
      <div className={rootClass}>
        <Link to={loginTo} className={styles.loginButton}>
          {authUk.loginButton}
        </Link>
      </div>
    );
  }

  if (meLoading && !meUser) {
    return (
      <div className={rootClass} aria-busy="true" aria-live="polite">
        <div className={styles.skeleton} aria-hidden="true" />
      </div>
    );
  }

  if (!meUser) {
    if (meError && !isUnauthorizedMeError(meError)) {
      const errorText =
        meError.message.includes('JWT') || meError.message.includes('claim email')
          ? authUk.jwtTemplateError
          : meError.message.includes('Clerk JWT template')
            ? meError.message
            : authUk.profileLoadError;
      return (
        <div className={rootClass}>
          <span className={styles.error} role="alert">
            {errorText}
          </span>
          {isAuthenticated ? (
            <button
              type="button"
              className={styles.logoutButton}
              onClick={() => {
                void logout();
              }}
            >
              {authUk.logoutButton}
            </button>
          ) : null}
        </div>
      );
    }
    return null;
  }

  return (
    <div className={rootClass}>
      <span className={styles.email} aria-label={`${authUk.accountEmailAria}: ${meUser.email}`}>
        {meUser.email}
      </span>
      <SubscriptionTierBadge tier={meUser.subscription} devMode={meUser.devMode === true} />
      {meUser.role === 'admin' ? (
        <Link to={paths.adminFeedback} className={styles.adminLink}>
          {adminFeedbackUk.accountLink}
        </Link>
      ) : null}
      {isAuthRequired || meUser.authProvider != null ? (
        <button
          type="button"
          className={styles.logoutButton}
          onClick={() => {
            void logout();
          }}
        >
          {authUk.logoutButton}
        </button>
      ) : null}
    </div>
  );
}
