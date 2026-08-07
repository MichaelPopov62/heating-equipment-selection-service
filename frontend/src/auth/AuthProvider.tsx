/**
 * Назначение: провайдер сессии — Clerk SDK (lazy), public guest или dev JWT scaffold.
 */

import { Suspense, lazy, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  clearStoredAuthToken,
  decodeJwtPayload,
  isAuthRequiredInFrontend,
  isClerkEnabled,
  readStoredAuthToken,
  writeStoredAuthToken,
} from './authConfig';
import { AuthContext, type AuthUser } from './authContext';
import { ClerkLoadContext } from './clerkLoadContext';
import { PublicAuthProviderInner } from './PublicAuthProviderInner';
import { useAuthMeCacheSync } from './useAuthMeCacheSync';

const ClerkAuthProviderInner = lazy(() =>
  import('./ClerkAuthProviderInner').then((m) => ({ default: m.ClerkAuthProviderInner })),
);

export type AuthProviderProps = {
  children: ReactNode;
};

/**
 * @param props
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const clerkLoadMode = useContext(ClerkLoadContext);

  if (!isClerkEnabled()) {
    return <LegacyAuthProviderInner>{children}</LegacyAuthProviderInner>;
  }

  if (clerkLoadMode === 'clerk') {
    return (
      <Suspense fallback={null}>
        <ClerkAuthProviderInner>{children}</ClerkAuthProviderInner>
      </Suspense>
    );
  }

  return <PublicAuthProviderInner>{children}</PublicAuthProviderInner>;
}

/**
 * Dev JWT scaffold без Clerk SDK.
 *
 * @param props
 */
function LegacyAuthProviderInner({ children }: AuthProviderProps) {
  const { refreshMeProfile, clearMeProfile } = useAuthMeCacheSync();
  const [user, setUser] = useState<AuthUser | null>(() => {
    const token = readStoredAuthToken();
    if (!token) return null;
    const payload = decodeJwtPayload(token);
    if (!payload) return null;
    return payload.email ? { sub: payload.sub, email: payload.email } : { sub: payload.sub };
  });

  const loginWithToken = useCallback(
    (token: string) => {
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
      refreshMeProfile();
    },
    [refreshMeProfile],
  );

  const logout = useCallback(() => {
    clearMeProfile();
    clearStoredAuthToken();
    setUser(null);
  }, [clearMeProfile]);

  const isAuthRequired = isAuthRequiredInFrontend();
  const isMeQueryEnabled = !isAuthRequired || user != null;

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !isAuthRequired || user != null,
      isMeQueryEnabled,
      isAuthRequired,
      loginWithToken,
      logout,
    }),
    [user, isAuthRequired, isMeQueryEnabled, loginWithToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
