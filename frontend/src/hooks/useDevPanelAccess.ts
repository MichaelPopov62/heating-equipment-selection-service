/**
 * Назначение: доступ к DevPanel — staging + admin; localhost — команда dev.
 */

import { useMemo } from 'react';

import { useAuth } from '../auth/useAuth';
import { useMeQuery } from '../query/queries/useMeQuery';
import {
  canShowDevPanelForUser,
  isDevToolsBuildEnabled,
  isLocalDevRuntime,
} from '../utils/isDevToolsEnabled';

export type UseDevPanelAccessResult = {
  /** Монтировать DevPanel (кнопка Dev). */
  canShowDevPanel: boolean;
  /** Dock: Dev и/или React Query Devtools (только localhost). */
  showDevToolsDock: boolean;
};

/**
 * @returns {UseDevPanelAccessResult}
 */
export function useDevPanelAccess(): UseDevPanelAccessResult {
  const { isMeQueryEnabled } = useAuth();
  const { user, meLoading } = useMeQuery();

  const meResolved =
    !isMeQueryEnabled || !meLoading;

  const canShowDevPanel = useMemo(
    () => canShowDevPanelForUser(user, meResolved),
    [user, meResolved],
  );

  const showDevToolsDock =
    isLocalDevRuntime() || (isDevToolsBuildEnabled() && canShowDevPanel);

  return { canShowDevPanel, showDevToolsDock };
}
