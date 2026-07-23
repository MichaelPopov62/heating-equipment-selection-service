/**
 * Назначение: провайдер сессии — Clerk SDK или dev JWT scaffold.
 */

import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setProjectsAuthTokenGetter } from '../services/projectsAuthToken';
import {
  clearStoredAuthToken,
  decodeJwtPayload,
  getClerkJwtTemplate,
  isAuthRequiredInFrontend,
  isClerkEnabled,
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
  if (isClerkEnabled()) {
    return <ClerkAuthProviderInner>{children}</ClerkAuthProviderInner>;
  }
  return <LegacyAuthProviderInner>{children}</LegacyAuthProviderInner>;
}

/**
 * Clerk session → AuthContext + getToken() для projects API.
 *
 * @param props
 */
function ClerkAuthProviderInner({ children }: AuthProviderProps) {
  const { getToken, isSignedIn, signOut } = useClerkAuth();
  const { user: clerkUser, isLoaded } = useUser();
  const jwtTemplate = getClerkJwtTemplate();
  const isAuthRequired = isAuthRequiredInFrontend();

  useEffect(() => {
    setProjectsAuthTokenGetter(async () => {
      if (!isSignedIn) return null;
      try {
        if (jwtTemplate) {
          return await getToken({ template: jwtTemplate });
        }
        return await getToken();
      } catch {
        return null;
      }
    });
    return () => {
      setProjectsAuthTokenGetter(null);
    };
  }, [getToken, isSignedIn, jwtTemplate]);

  const user = useMemo((): AuthUser | null => {
    if (!isLoaded || !isSignedIn || !clerkUser) return null;
    const emailAddress = clerkUser.primaryEmailAddress?.emailAddress;
    const email = typeof emailAddress === 'string' ? emailAddress.trim() : undefined;
    return email ? { sub: clerkUser.id, email } : { sub: clerkUser.id };
  }, [clerkUser, isLoaded, isSignedIn]);

  const loginWithToken = useCallback((token: string) => {
    const trimmed = token.trim();
    if (!trimmed) return;
    writeStoredAuthToken(trimmed);
  }, []);

  const logout = useCallback(async () => {
    clearStoredAuthToken();
    await signOut();
  }, [signOut]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !isAuthRequired || (isLoaded && isSignedIn === true),
      isAuthRequired,
      loginWithToken,
      logout,
    }),
    [user, isAuthRequired, isLoaded, isSignedIn, loginWithToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Dev JWT scaffold без Clerk SDK.
 *
 * @param props
 */
function LegacyAuthProviderInner({ children }: AuthProviderProps) {
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
