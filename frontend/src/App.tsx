/**
 * Назначение: Корень приложения — router + providers.
 */

import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from './auth/AuthProvider';
import { getClerkPublishableKey } from './auth/authConfig';
import { AppErrorBoundary } from './components/AppErrorBoundary/AppErrorBoundary';
import { AppRouter } from './routing/AppRouter';
import { AppChromeProvider } from './shell/AppChromeProvider';

function AppProviders() {
  return (
    <AuthProvider>
      <AppChromeProvider>
        <AppRouter />
      </AppChromeProvider>
    </AuthProvider>
  );
}

function App() {
  const clerkPublishableKey = getClerkPublishableKey();

  return (
    <AppErrorBoundary>
      <BrowserRouter>
        {clerkPublishableKey ? (
          <ClerkProvider publishableKey={clerkPublishableKey}>
            <AppProviders />
          </ClerkProvider>
        ) : (
          <AppProviders />
        )}
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
