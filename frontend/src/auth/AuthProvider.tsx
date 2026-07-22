/**
 * Назначение: провайдер сессии JWT (prod SaaS scaffold).
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';

import {
  clearStoredAuthToken,
  decodeJwtPayload,
  isAuthRequiredInFrontend,
  readStoredAuthToken,
  writeStoredAuthToken,
} from './authConfig';
import { AuthContext, type AuthUser } from './authContext';

export type AuthProviderProps = {
  children: ReactNode;
};

/**
 * @param props
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = readStoredAuthToken();
    if (!token) return null;
    const payload = decodeJwtPayload(token);
    if (!payload) return null;
    return payload.email ? { sub: payload.sub, email: payload.email } : { sub: payload.sub };
  });

  const loginWithToken = useCallback((token: string) => {
    const trimmed = token.trim();
    if (!trimmed) return;
    writeStoredAuthToken(trimmed);
    const payload = decodeJwtPayload(trimmed);
    if (payload) {
      setUser(
        payload.email
          ? { sub: payload.sub, email: payload.email }
          : { sub: payload.sub },
      );
    } else {
      setUser({ sub: 'authenticated' });
    }
  }, []);

  const logout = useCallback(() => {
    clearStoredAuthToken();
    setUser(null);
  }, []);

  const isAuthRequired = isAuthRequiredInFrontend();

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !isAuthRequired || user != null,
      isAuthRequired,
      loginWithToken,
      logout,
    }),
    [user, isAuthRequired, loginWithToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
