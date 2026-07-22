/**
 * Назначение: guard маршрутов, требующих входа (prod SaaS).
 */

import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from './useAuth';
import { paths } from '../routing/paths';

export type ProtectedRouteProps = {
  children: React.ReactNode;
};

/**
 * @param props
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isAuthRequired } = useAuth();
  const location = useLocation();

  if (isAuthRequired && !isAuthenticated) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`${paths.login}?returnTo=${returnTo}`} replace />;
  }

  return children;
}
