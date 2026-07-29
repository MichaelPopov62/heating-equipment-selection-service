/**
 * Назначение: маршрутизация SPA (prod SaaS).
 */

import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';

import { ProtectedRoute } from '../auth/ProtectedRoute';
import { AppBootstrapSkeleton } from '../components/AppBootstrapSkeleton/AppBootstrapSkeleton';
import { CookieConsentBanner } from '../components/CookieConsentBanner/CookieConsentBanner';
import { ModalHost } from '../components/ModalHost/ModalHost';
import { paths } from './paths';
import { SurveyAppShell } from './SurveyAppShell';

const LoginPage = lazy(() =>
  import('../pages/LoginPage/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const SignUpPage = lazy(() =>
  import('../pages/SignUpPage/SignUpPage').then((m) => ({ default: m.SignUpPage })),
);
const DocsPage = lazy(() =>
  import('../pages/DocsPage/DocsPage').then((m) => ({ default: m.DocsPage })),
);
const FaqPage = lazy(() =>
  import('../pages/FaqPage/FaqPage').then((m) => ({ default: m.FaqPage })),
);
const LegalPage = lazy(() =>
  import('../pages/LegalPage/LegalPage').then((m) => ({ default: m.LegalPage })),
);
const ProjectsPage = lazy(() =>
  import('../pages/ProjectsPage/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
);
const SharePresentationPage = lazy(() =>
  import('../components/SharePresentationPage/SharePresentationPage').then((m) => ({
    default: m.SharePresentationPage,
  })),
);

/**
 * Корневой router приложения.
 */
export function AppRouter() {
  return (
    <>
      <Suspense fallback={<AppBootstrapSkeleton statusLabel="Завантаження сторінки…" />}>
        <Routes>
          <Route path="/s/:shareToken" element={<ShareRoute />} />
          <Route path={`${paths.login}/*`} element={<LoginPage />} />
          <Route path={`${paths.signUp}/*`} element={<SignUpPage />} />
          <Route path={paths.docs} element={<DocsPage />} />
          <Route path={paths.faq} element={<FaqPage />} />
          <Route path={paths.privacy} element={<LegalPage kind="privacy" />} />
          <Route path={paths.terms} element={<LegalPage kind="terms" />} />
          <Route path={paths.cookies} element={<LegalPage kind="cookies" />} />
          <Route
            path={paths.projects}
            element={
              <SurveyAppShell>
                <ProtectedRoute>
                  <ProjectsPage />
                </ProtectedRoute>
              </SurveyAppShell>
            }
          />
          <Route path={paths.home} element={<SurveyAppShell />} />
          <Route path="*" element={<Navigate to={paths.home} replace />} />
        </Routes>
      </Suspense>
      <ModalHost />
      <CookieConsentBanner />
    </>
  );
}

/**
 * Share presentation з token param.
 */
function ShareRoute() {
  const { shareToken } = useParams<{ shareToken: string }>();
  if (!shareToken?.trim()) {
    return <Navigate to={paths.home} replace />;
  }
  return <SharePresentationPage shareToken={shareToken.trim()} />;
}
