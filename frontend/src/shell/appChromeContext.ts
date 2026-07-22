/**
 * Назначение: контекст shell — modals и footer actions.
 */

import { createContext } from 'react';

import type { FooterModalId } from '../routing/paths';

export type AppChromeContextValue = {
  activeModal: FooterModalId | null;
  openModal: (id: FooterModalId) => void;
  closeModal: () => void;
  onNewCalculation: (() => void) | null;
  onOpenProjects: (() => void) | null;
  registerFooterActions: (actions: {
    onNewCalculation?: () => void;
    onOpenProjects?: () => void;
  }) => void;
  unregisterFooterActions: () => void;
};

export const AppChromeContext = createContext<AppChromeContextValue | null>(null);

export type FooterVariant = 'app' | 'public' | 'share';
