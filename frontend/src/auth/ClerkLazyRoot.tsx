/**
 * Назначение: lazy ClerkProvider — SDK лише на auth/projects/admin маршрутах (1b-6).
 */

import { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router';

import { AppBootstrapSkeleton } from '../components/AppBootstrapSkeleton/AppBootstrapSkeleton';
import { getClerkPublishableKey, isClerkEnabled } from './authConfig';
import { ClerkLoadContext, type ClerkLoadMode } from './clerkLoadContext';
import { shouldLoadClerkForPath } from './shouldLoadClerkForPath';

const ClerkProviderWithRouter = lazy(() =>
  import('./ClerkProviderWithRouter').then((m) => ({ default: m.ClerkProviderWithRouter })),
);

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
  const [clerkSticky, setClerkSticky] = useState(routeNeedsClerk);

  useEffect(() => {
    if (routeNeedsClerk) {
      setClerkSticky(true);
    }
  }, [routeNeedsClerk]);

  if (!isClerkEnabled() || !publishableKey) {
    const mode: ClerkLoadMode = 'legacy';
    return (
      <ClerkLoadContext.Provider value={mode}>{children}</ClerkLoadContext.Provider>
    );
  }

  const clerkActive = routeNeedsClerk || clerkSticky;

  if (!clerkActive) {
    return (
      <ClerkLoadContext.Provider value="public">{children}</ClerkLoadContext.Provider>
    );
  }

  return (
    <ClerkLoadContext.Provider value="clerk">
      <Suspense
        fallback={
          <AppBootstrapSkeleton statusLabel="Завантаження автентифікації…" />
        }
      >
        <ClerkProviderWithRouter publishableKey={publishableKey}>
          {children}
        </ClerkProviderWithRouter>
      </Suspense>
    </ClerkLoadContext.Provider>
  );
}
