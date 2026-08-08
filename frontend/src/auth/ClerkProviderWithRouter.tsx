/**
 * Назначение: ClerkProvider с интеграцией React Router (SPA-навигация без reload).
 */

import { ClerkProvider } from '@clerk/clerk-react';
import { useNavigate } from 'react-router';

import '../styles/clerkGlobal.css';
import { clerkAppearance } from '../i18n/clerkAppearance';
import { clerkUkLocalization } from '../i18n/clerkUkLocalization';

export type ClerkProviderWithRouterProps = {
  publishableKey: string;
  children: React.ReactNode;
};

/**
 * ClerkProvider + routerPush/routerReplace — без window.location после sign-in.
 *
 * @param props
 */
export function ClerkProviderWithRouter({
  publishableKey,
  children,
}: ClerkProviderWithRouterProps) {
  const navigate = useNavigate();

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      localization={clerkUkLocalization}
      appearance={clerkAppearance}
      routerPush={(to) => {
        void navigate(to);
      }}
      routerReplace={(to) => {
        void navigate(to, { replace: true });
      }}
    >
      {children}
    </ClerkProvider>
  );
}
