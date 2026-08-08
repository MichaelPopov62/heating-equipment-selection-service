/**
 * Назначение: lazy ClerkProvider — SDK лише на auth/projects/admin маршрутах (1b-6).
 */

import { Suspense, lazy, useLayoutEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router';

import { ClerkAuthLoadingFallback } from '../components/ClerkAuthLoadingFallback/ClerkAuthLoadingFallback';
import { getClerkPublishableKey, isClerkEnabled } from './authConfig';
import { ClerkLoadContext, type ClerkLoadMode } from './clerkLoadContext';
import { shouldLoadClerkForPath } from './shouldLoadClerkForPath';

const CLERK_STICKY_STORAGE_KEY = 'heatcalc:clerk-sticky:v1';

const ClerkProviderWithRouter = lazy(() =>
  import('./ClerkProviderWithRouter').then((m) => ({ default: m.ClerkProviderWithRouter })),
);

/**
 * @returns {boolean}
 */
function readClerkStickyFromStorage(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(CLERK_STICKY_STORAGE_KEY) === '1';
}

export type ClerkLazyRootProps = {
  children: ReactNode;
};

/**
 * @param props
 */
export function ClerkLazyRoot({ children }: ClerkLazyRootProps) {
  const { pathname } = useLocation();
  const publishableKey = getClerkPublishableKey();
  const routeNeedsClerk = shouldLoadClerkForPath(pathname);

  useLayoutEffect(() => {
    if (!routeNeedsClerk) return;
    sessionStorage.setItem(CLERK_STICKY_STORAGE_KEY, '1');
  }, [routeNeedsClerk]);

  if (!isClerkEnabled() || !publishableKey) {
    const mode: ClerkLoadMode = 'legacy';
    return (
      <ClerkLoadContext.Provider value={mode}>{children}</ClerkLoadContext.Provider>
    );
  }

  const clerkActive = routeNeedsClerk || readClerkStickyFromStorage();

  if (!clerkActive) {
    return (
      <ClerkLoadContext.Provider value="public">{children}</ClerkLoadContext.Provider>
    );
  }

  return (
    <ClerkLoadContext.Provider value="clerk">
      <Suspense
        fallback={<ClerkAuthLoadingFallback />}
      >
        <ClerkProviderWithRouter publishableKey={publishableKey}>
          {children}
        </ClerkProviderWithRouter>
      </Suspense>
    </ClerkLoadContext.Provider>
  );
}
