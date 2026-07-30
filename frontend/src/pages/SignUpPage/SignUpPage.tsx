/**
 * Назначение: страница регистрации (prod SaaS, Clerk SignUp).
 */

import { SignedOut, SignUp } from '@clerk/clerk-react';
import { Link, useSearchParams } from 'react-router';

import { AuthRedirectShell } from '../../components/AuthRedirectShell/AuthRedirectShell';
import { Footer } from '../../components/Footer/Footer';
import { ClerkAuthWidget } from '../../components/ClerkAuthWidget/ClerkAuthWidget';
import { useAuthRedirectAfterClerk } from '../../auth/useAuthRedirectAfterClerk';
import { authUk } from '../../i18n/uk/auth';
import { footerUk } from '../../i18n/uk/footer';
import { paths } from '../../routing/paths';
import styles from '../LoginPage/LoginPage.module.css';

/**
 * Clerk SignUp с virtual-routing (URL без подшагов — меньше remount и белой вспышки).
 */
export function SignUpPage() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || paths.home;
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
        <h1 className={styles.title}>{authUk.signUpTitle}</h1>
        <p className={styles.lead}>{authUk.signUpLead}</p>

        <ClerkAuthWidget>
          <SignedOut>
            <SignUp
              routing="virtual"
              signInUrl={paths.login}
            />
          </SignedOut>
        </ClerkAuthWidget>
        <p className={styles.hint}>{authUk.signUpPasswordHint}</p>
      </main>
      <Footer variant="public" />
    </div>
  );
}
