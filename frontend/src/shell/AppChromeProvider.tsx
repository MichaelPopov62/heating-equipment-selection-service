/**
 * Назначение: провайдер modals и footer actions для prod SaaS shell.
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';

import type { FooterModalId } from '../routing/paths';
import { AppChromeContext } from './appChromeContext';

export type AppChromeProviderProps = {
  children: ReactNode;
};

/**
 * @param props
 */
export function AppChromeProvider({ children }: AppChromeProviderProps) {
  const [activeModal, setActiveModal] = useState<FooterModalId | null>(null);
  const [onNewCalculation, setOnNewCalculation] = useState<(() => void) | null>(null);
  const [onOpenProjects, setOnOpenProjects] = useState<(() => void) | null>(null);

  const openModal = useCallback((id: FooterModalId) => {
    setActiveModal(id);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const registerFooterActions = useCallback(
    (actions: { onNewCalculation?: () => void; onOpenProjects?: () => void }) => {
      if (actions.onNewCalculation) setOnNewCalculation(() => actions.onNewCalculation);
      if (actions.onOpenProjects) setOnOpenProjects(() => actions.onOpenProjects);
    },
    [],
  );

  const unregisterFooterActions = useCallback(() => {
    setOnNewCalculation(null);
    setOnOpenProjects(null);
  }, []);

  const value = useMemo(
    () => ({
      activeModal,
      openModal,
      closeModal,
      onNewCalculation,
      onOpenProjects,
      registerFooterActions,
      unregisterFooterActions,
    }),
    [
      activeModal,
      openModal,
      closeModal,
      onNewCalculation,
      onOpenProjects,
      registerFooterActions,
      unregisterFooterActions,
    ],
  );

  return <AppChromeContext.Provider value={value}>{children}</AppChromeContext.Provider>;
}
