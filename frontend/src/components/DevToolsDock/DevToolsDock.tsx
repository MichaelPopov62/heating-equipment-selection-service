/**
 * Назначение: dock для React Query Devtools и кнопки Dev (ряд справа: Dev слева, RQ справа).
 */

import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import type { ReactNode } from 'react';

import styles from './DevToolsDock.module.css';

export type DevToolsDockProps = {
  /** DevPanel (кнопка Dev или открытая панель). */
  children?: ReactNode;
};

/**
 * @param props
 */
export function DevToolsDock({ children }: DevToolsDockProps) {
  const showReactQuery = import.meta.env.DEV;

  if (!showReactQuery && children == null) {
    return null;
  }

  return (
    <div className={styles.dock}>
      {children != null ? <div className={styles.devSlot}>{children}</div> : null}
      {showReactQuery ? (
        <div className={styles.reactQuerySlot}>
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="relative" />
        </div>
      ) : null}
    </div>
  );
}
