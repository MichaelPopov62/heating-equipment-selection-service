/**
 * Назначение: Корень приложения — router + providers.
 */

import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from './auth/AuthProvider';
import { AppErrorBoundary } from './components/AppErrorBoundary/AppErrorBoundary';
import { AppRouter } from './routing/AppRouter';
import { AppChromeProvider } from './shell/AppChromeProvider';

function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppChromeProvider>
            <AppRouter />
          </AppChromeProvider>
        </AuthProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
