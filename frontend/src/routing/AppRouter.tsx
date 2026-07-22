/**
 * Назначение: маршрутизация SPA (prod SaaS).
 */

import { Navigate, Route, Routes, useParams } from 'react-router-dom';

import { ProtectedRoute } from '../auth/ProtectedRoute';
import { CookieConsentBanner } from '../components/CookieConsentBanner/CookieConsentBanner';
import { ModalHost } from '../components/ModalHost/ModalHost';
import { SharePresentationPage } from '../components/SharePresentationPage/SharePresentationPage';
import { DocsPage } from '../pages/DocsPage/DocsPage';
import { FaqPage } from '../pages/FaqPage/FaqPage';
import { LegalPage } from '../pages/LegalPage/LegalPage';
import { LoginPage } from '../pages/LoginPage/LoginPage';
import { ProjectsPage } from '../pages/ProjectsPage/ProjectsPage';
import { paths } from './paths';
import { SurveyAppShell } from './SurveyAppShell';

/**
 * Корневой router приложения.
 */
export function AppRouter() {
  return (
    <>
      <Routes>
        <Route path="/s/:shareToken" element={<ShareRoute />} />
        <Route path={paths.login} element={<LoginPage />} />
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
