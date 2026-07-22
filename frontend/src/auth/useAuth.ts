/**
 * Назначение: хук доступа к AuthContext.
 */

import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from './authContext';

/**
 * @returns {AuthContextValue}
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
