/**
 * Назначение: панель сессии пользователя (email + logout).
 */

import { useAuth } from '../../auth/useAuth';
import { authUk } from '../../i18n/uk/auth';
import styles from './AuthSessionBar.module.css';

export type AuthSessionBarProps = {
  className?: string | undefined;
};

/**
 * @param props
 */
export function AuthSessionBar({ className }: AuthSessionBarProps) {
  const { user, isAuthenticated, isAuthRequired, logout } = useAuth();

  if (!isAuthRequired || !isAuthenticated) return null;

  const label = user?.email ?? user?.sub ?? authUk.sessionActive;

  return (
    <div className={className ? `${styles.bar} ${className}` : styles.bar}>
      <span className={styles.label}>{label}</span>
      <button
        type="button"
        className={styles.logout}
        onClick={() => {
          void logout();
        }}
      >
        {authUk.logout}
      </button>
    </div>
  );
}
