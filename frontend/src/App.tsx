/**
 * Назначение: Корень приложения — router + providers.
 */

import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from './auth/AuthProvider';
import { ClerkProviderWithRouter } from './auth/ClerkProviderWithRouter';
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
          <ClerkProviderWithRouter publishableKey={clerkPublishableKey}>
            <AppProviders />
          </ClerkProviderWithRouter>
        ) : (
          <AppProviders />
        )}
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
