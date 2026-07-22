/**
 * Назначение: хук AppChromeContext.
 */

import { useContext } from 'react';

import { AppChromeContext, type AppChromeContextValue } from './appChromeContext';

/**
 * @returns {AppChromeContextValue}
 */
export function useAppChrome(): AppChromeContextValue {
  const ctx = useContext(AppChromeContext);
  if (!ctx) {
    throw new Error('useAppChrome must be used within AppChromeProvider');
  }
  return ctx;
}
