/**
 * Назначение: провайдер сессии — Clerk SDK или dev JWT scaffold.
 */

import { useAuth as useClerkAuth, useUser } from '@clerk/clerk-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';

import { setProjectsAuthTokenGetter } from '../services/projectsAuthToken';
import {
  clearStoredAuthToken,
  decodeJwtPayload,
  getClerkJwtTemplate,
  isAuthRequiredInFrontend,
  isClerkEnabled,
  readStoredAuthToken,
  resolveClerkJwtTemplateForApi,
  writeStoredAuthToken,
} from './authConfig';
import { AuthContext, type AuthUser } from './authContext';
import { useAuthMeCacheSync } from './useAuthMeCacheSync';

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
  const { getToken, isSignedIn, signOut, isLoaded } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const jwtTemplate = resolveClerkJwtTemplateForApi();
  const isAuthRequired = isAuthRequiredInFrontend();
  const { refreshMeProfile, clearMeProfile } = useAuthMeCacheSync();
  const clerkSessionReady = isLoaded && isSignedIn;

  useEffect(() => {
    if (import.meta.env.DEV && isClerkEnabled() && !getClerkJwtTemplate()) {
      console.warn(
        `[auth] VITE_CLERK_JWT_TEMPLATE не задан — используется "${jwtTemplate}". ` +
          'Создайте JWT template в Clerk с claim email и aud = AUTH_AUDIENCE.',
      );
    }
  }, [jwtTemplate]);

  useLayoutEffect(() => {
    if (!clerkSessionReady) {
      setProjectsAuthTokenGetter(null);
      return;
    }

    setProjectsAuthTokenGetter(async () => {
      try {
        const token = await getToken({ template: jwtTemplate });
        if (token && import.meta.env.DEV) {
          const payload = decodeJwtPayload(token);
          if (!payload?.email) {
            console.warn(
              `[auth] JWT template "${jwtTemplate}" без claim email. ` +
                'Clerk Dashboard → JWT Templates → добавьте email: {{user.primary_email_address}}',
            );
          }
        }
        return token;
      } catch {
        return null;
      }
    });

    return () => {
      setProjectsAuthTokenGetter(null);
    };
  }, [getToken, clerkSessionReady, jwtTemplate]);

  useEffect(() => {
    if (!clerkSessionReady) return;
    refreshMeProfile();
  }, [clerkSessionReady, refreshMeProfile]);

  const user = useMemo((): AuthUser | null => {
    if (!isLoaded || !isSignedIn || !clerkUser) return null;
    const emailAddress = clerkUser.primaryEmailAddress?.emailAddress;
    const email = typeof emailAddress === 'string' ? emailAddress.trim() : undefined;
    return email ? { sub: clerkUser.id, email } : { sub: clerkUser.id };
  }, [clerkUser, isLoaded, isSignedIn]);

  const loginWithToken = useCallback(
    (token: string) => {
      const trimmed = token.trim();
      if (!trimmed) return;
      writeStoredAuthToken(trimmed);
      refreshMeProfile();
    },
    [refreshMeProfile],
  );

  const logout = useCallback(async () => {
    clearMeProfile();
    clearStoredAuthToken();
    await signOut();
  }, [clearMeProfile, signOut]);

  const isMeQueryEnabled = !isAuthRequired || clerkSessionReady;

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !isAuthRequired || clerkSessionReady,
      isMeQueryEnabled,
      isAuthRequired,
      loginWithToken,
      logout,
    }),
    [
      user,
      isAuthRequired,
      clerkSessionReady,
      isMeQueryEnabled,
      loginWithToken,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
