/**
 * Назначение: Error boundary для bootstrap и основного UI.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

import styles from './AppErrorBoundary.module.css';

export type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

/**
 *
 */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('[AppErrorBoundary]', error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.root} role="alert">
          <h1 className={styles.title}>Не вдалося завантажити застосунок</h1>
          <p className={styles.message}>
            Оновіть сторінку. Якщо помилка повторюється — очистіть локальну чернетку
            або зверніться до підтримки.
          </p>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              window.location.reload();
            }}
          >
            Оновити сторінку
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
