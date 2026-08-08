/**
 * Назначение: Точка входа React-приложения.
 * Описание: Монтирует корневой компонент App в DOM через createRoot в режиме StrictMode.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/formElements.css';
import './styles/containers.css';
import './index.css';
import App from './App.tsx';
import { QueryProvider } from './query/QueryProvider';
import { fadeOutStaticShell, dismissStaticAppShellImmediately } from './utils/staticAppShellTransition';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Не знайдено елемент #root для монтування застосунку');
}

const appRoot = rootEl;

/**
 * Mount React одразу; static overlay (#static-app-shell) зникає паралельно (crossfade).
 */
function bootstrapApp(): void {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    dismissStaticAppShellImmediately();
  } else {
    appRoot.classList.add('app-root--fade-in');
    void fadeOutStaticShell();
  }

  createRoot(appRoot).render(
    <StrictMode>
      <QueryProvider>
        <App />
      </QueryProvider>
    </StrictMode>,
  );
}

bootstrapApp();
