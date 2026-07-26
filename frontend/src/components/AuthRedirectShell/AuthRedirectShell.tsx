/**
 * Назначение: placeholder страницы auth на время SPA-редиректа после Clerk.
 */

import { Footer } from '../Footer/Footer';
import { authUk } from '../../i18n/uk/auth';
import styles from '../../pages/LoginPage/LoginPage.module.css';

/**
 * Полноэкранный фон темы до завершения navigate(returnTo).
 */
export function AuthRedirectShell() {
  return (
    <div className={styles.page}>
      <main className={styles.redirectMain} aria-busy="true" aria-live="polite">
        <span className={styles.visuallyHidden}>{authUk.redirectingAfterLogin}</span>
      </main>
      <Footer variant="public" />
    </div>
  );
}
