/**
 * Назначение: чи потрібен Clerk SDK для поточного маршруту (1b-6 perf).
 */

import { paths } from '../routing/paths';

/**
 * @param pathname — location.pathname
 * @returns true для auth/projects/admin маршрутів
 */
export function shouldLoadClerkForPath(pathname: string): boolean {
  if (pathname === paths.login || pathname.startsWith(`${paths.login}/`)) {
    return true;
  }
  if (pathname === paths.signUp || pathname.startsWith(`${paths.signUp}/`)) {
    return true;
  }
  if (pathname === paths.projects || pathname.startsWith(`${paths.projects}/`)) {
    return true;
  }
  if (pathname === paths.adminFeedback || pathname.startsWith('/admin/')) {
    return true;
  }
  return false;
}
