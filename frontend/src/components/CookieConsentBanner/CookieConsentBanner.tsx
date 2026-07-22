/**
 * Назначение: банер згоди на cookie (prod SaaS, UA).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';

import { COOKIE_CONSENT_STORAGE_KEY } from '../../auth/authConfig';
import { cookieConsentUk } from '../../i18n/uk/cookieConsent';
import { paths } from '../../routing/paths';
import styles from './CookieConsentBanner.module.css';

/**
 * @returns {boolean}
 */
function hasConsent(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === 'accepted';
}

/**
 * Банер cookie/localStorage (необхідні only на MVP).
 */
export function CookieConsentBanner() {
  const [visible, setVisible] = useState(() => !hasConsent());

  if (!visible) return null;

  return (
    <div className={styles.banner} role="dialog" aria-live="polite" aria-label="Cookie consent">
      <p className={styles.text}>
        {cookieConsentUk.message}{' '}
        <Link to={paths.cookies} className={styles.link}>
          {cookieConsentUk.learnMore}
        </Link>
      </p>
      <button
        type="button"
        className={styles.button}
        onClick={() => {
          localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, 'accepted');
          setVisible(false);
        }}
      >
        {cookieConsentUk.accept}
      </button>
    </div>
  );
}
