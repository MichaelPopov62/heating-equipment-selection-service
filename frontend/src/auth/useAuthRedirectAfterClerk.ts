/**
 * Назначение: SPA-редирект после Clerk sign-in/sign-up без fallbackRedirectUrl.
 */

import { useAuth as useClerkAuth } from '@clerk/clerk-react';
import { useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from './useAuth';

/**
 * @param returnTo — целевой path после успешной сессии
 * @returns true — показывать placeholder вместо формы входа
 */
export function useAuthRedirectAfterClerk(returnTo: string): boolean {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isLoaded: clerkLoaded, isSignedIn } = useClerkAuth();
  const redirectPending = isAuthenticated || (clerkLoaded && isSignedIn);

  useLayoutEffect(() => {
    if (redirectPending) {
      void navigate(returnTo, { replace: true });
    }
  }, [redirectPending, navigate, returnTo]);

  return redirectPending;
}
