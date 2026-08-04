/**
 * Назначение: флаги DevPanel — только staging-билд + admin (production master без Dev).
 */

import type { MeUser } from '../types/meApi';

/**
 * Локальный Vite dev — DevPanel для команды без ограничений.
 */
export function isLocalDevRuntime(): boolean {
  return import.meta.env.DEV;
}

/**
 * Deployed-билд разрешает Dev-слой только на staging Vercel:
 * VITE_DEV_TOOLS=1 и VITE_APP_ENV=staging (не production master).
 */
export function isDevToolsBuildEnabled(): boolean {
  if (isLocalDevRuntime()) return true;
  if (import.meta.env.VITE_DEV_TOOLS !== '1') return false;
  return import.meta.env.VITE_APP_ENV === 'staging';
}

/**
 * Показывать DevPanel: localhost — всем; staging deploy — только role=admin.
 *
 * @param user — профиль GET /api/v1/me
 * @param meResolved — /me завершён (не pending при enabled query)
 */
export function canShowDevPanelForUser(
  user: MeUser | null,
  meResolved: boolean,
): boolean {
  if (isLocalDevRuntime()) return true;
  if (!isDevToolsBuildEnabled()) return false;
  if (!meResolved) return false;
  return user?.role === 'admin';
}
