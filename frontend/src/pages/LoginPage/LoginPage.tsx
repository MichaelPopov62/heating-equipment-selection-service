/**
 * Назначение: страница входа (prod SaaS).
 */

import { SignedOut, SignIn } from '@clerk/clerk-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { AuthRedirectShell } from '../../components/AuthRedirectShell/AuthRedirectShell';
import { Footer } from '../../components/Footer/Footer';
import {
  ClerkAuthWidget,
} from '../../components/ClerkAuthWidget/ClerkAuthWidget';
import { getAuthLoginUrl, isClerkEnabled } from '../../auth/authConfig';
import { useAuth } from '../../auth/useAuth';
import { useAuthRedirectAfterClerk } from '../../auth/useAuthRedirectAfterClerk';
import { authUk } from '../../i18n/uk/auth';
import { footerUk } from '../../i18n/uk/footer';
import { paths } from '../../routing/paths';
import styles from './LoginPage.module.css';

/**
 * Clerk SignIn, hosted redirect или dev JWT.
 */
export function LoginPage() {
  const { loginWithToken } = useAuth();
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const hostedUrl = getAuthLoginUrl();
  const returnTo = searchParams.get('returnTo') || paths.home;
  const clerkEnabled = isClerkEnabled();
  const redirectPending = useAuthRedirectAfterClerk(returnTo);

  if (redirectPending) {
    return <AuthRedirectShell />;
  }

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Link to={paths.home} className={styles.backLink}>
          ← {footerUk.links.home}
        </Link>
        <h1 className={styles.title}>{authUk.loginTitle}</h1>
        <p className={styles.lead}>{authUk.loginLead}</p>

        {clerkEnabled ? (
          <>
            <ClerkAuthWidget>
              <SignedOut>
                <SignIn
                  routing="virtual"
                  signInUrl={paths.login}
                  signUpUrl={paths.signUp}
                />
              </SignedOut>
            </ClerkAuthWidget>
            <p className={styles.hint}>{authUk.loginClerkHint}</p>
          </>
        ) : hostedUrl ? (
          <a href={hostedUrl} className={styles.primary}>
            {authUk.loginRedirect}
          </a>
        ) : (
          <>
            <label className={styles.field}>
              <span className={styles.label}>{authUk.loginDevTokenLabel}</span>
              <input
                type="password"
                className={styles.input}
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                }}
                placeholder={authUk.loginDevTokenPlaceholder}
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                loginWithToken(token);
              }}
            >
              {authUk.loginDevSubmit}
            </button>
            <p className={styles.hint}>{authUk.loginDevHint}</p>
          </>
        )}
      </main>
      <Footer variant="public" />
    </div>
  );
}
