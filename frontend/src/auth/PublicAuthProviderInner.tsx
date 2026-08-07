/**
 * Назначение: AuthContext без Clerk SDK — публічні маршрути до lazy-load Clerk.
 */

import { useCallback, useMemo, type ReactNode } from 'react';

import { isAuthRequiredInFrontend } from './authConfig';
import { AuthContext } from './authContext';

export type PublicAuthProviderInnerProps = {
  children: ReactNode;
};

/**
 * Гість: без /me, без getToken. «Увійти» веде на /login, де підвантажиться Clerk.
 *
 * @param props
 */
export function PublicAuthProviderInner({ children }: PublicAuthProviderInnerProps) {
  const isAuthRequired = isAuthRequiredInFrontend();

  const loginWithToken = useCallback((_token: string) => {
    /* dev JWT на публічних маршрутах з Clerk не використовується */
  }, []);

  const logout = useCallback(async () => {
    /* logout доступний після завантаження ClerkAuthProviderInner */
  }, []);

  const value = useMemo(
    () => ({
      user: null,
      isAuthenticated: !isAuthRequired,
      isMeQueryEnabled: false,
      isAuthRequired,
      loginWithToken,
      logout,
    }),
    [isAuthRequired, loginWithToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
