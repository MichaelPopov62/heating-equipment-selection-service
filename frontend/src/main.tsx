/**
 * Назначение: Точка входа React-приложения.
 * Описание: Монтирует корневой компонент App в DOM через createRoot в режиме StrictMode.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';
import App from './App.tsx';
import { QueryProvider } from './query/QueryProvider';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Не найден элемент #root для монтирования приложения');
}

createRoot(rootEl).render(
  <StrictMode>
    <QueryProvider>
      <App />
    </QueryProvider>
  </StrictMode>,
);
