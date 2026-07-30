/**
 * Назначение: guard маршрутов, доступных только роли admin из GET /api/v1/me.
 */

import { Navigate } from 'react-router';

import { AppBootstrapSkeleton } from '../components/AppBootstrapSkeleton/AppBootstrapSkeleton';
import { adminFeedbackUk } from '../i18n/uk/adminFeedback';
import { useMeQuery } from '../query/queries/useMeQuery';
import { paths } from '../routing/paths';

export type AdminRouteProps = {
  children: React.ReactNode;
};

/**
 * @param props
 */
export function AdminRoute({ children }: AdminRouteProps) {
  const { user, meLoading } = useMeQuery();

  if (!user && meLoading) {
    return <AppBootstrapSkeleton statusLabel={adminFeedbackUk.checkingAccess} />;
  }
  if (user?.role !== 'admin') {
    return <Navigate to={paths.home} replace />;
  }
  return children;
}
