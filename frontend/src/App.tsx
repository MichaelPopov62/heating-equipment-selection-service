/**
 * Назначение: Корень приложения — router + providers.
 */

import { BrowserRouter } from 'react-router';

import { AuthProvider } from './auth/AuthProvider';
import { ClerkLazyRoot } from './auth/ClerkLazyRoot';
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
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <ClerkLazyRoot>
          <AppProviders />
        </ClerkLazyRoot>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
