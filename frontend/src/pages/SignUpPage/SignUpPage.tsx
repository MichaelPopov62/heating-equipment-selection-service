/**
 * Назначение: страница регистрации (prod SaaS, Clerk SignUp).
 */

import { SignUp } from '@clerk/clerk-react';
import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Footer } from '../../components/Footer/Footer';
import { useAuth } from '../../auth/useAuth';
import { authUk } from '../../i18n/uk/auth';
import { footerUk } from '../../i18n/uk/footer';
import { paths } from '../../routing/paths';
import styles from '../LoginPage/LoginPage.module.css';

/**
 * Clerk SignUp с path-routing (/sign-up/*).
 */
export function SignUpPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || paths.home;

  useEffect(() => {
    if (isAuthenticated) {
      void navigate(returnTo, { replace: true });
    }
  }, [isAuthenticated, navigate, returnTo]);

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Link to={paths.home} className={styles.backLink}>
          ← {footerUk.links.home}
        </Link>
        <h1 className={styles.title}>{authUk.signUpTitle}</h1>
        <p className={styles.lead}>{authUk.signUpLead}</p>

        <div className={styles.clerkRoot}>
          <SignUp
            routing="path"
            path={paths.signUp}
            signInUrl={paths.login}
            fallbackRedirectUrl={returnTo}
          />
        </div>
      </main>
      <Footer variant="public" />
    </div>
  );
}
