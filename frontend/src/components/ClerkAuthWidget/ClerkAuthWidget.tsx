/**
 * Назначение: оболочка Clerk SignIn/SignUp — стабильный фон без оверлея (один UI, без двойных спиннеров).
 * Стили Clerk — только через clerkAppearance на ClerkProvider (SSOT).
 */

import type { ReactNode } from 'react';

import styles from './ClerkAuthWidget.module.css';

export type ClerkAuthWidgetProps = {
  children: ReactNode;
};

/**
 * Стабильная карточка: фон и min-height. Переходы между шагами — через routing="virtual" у Clerk.
 *
 * @param props
 */
export function ClerkAuthWidget({ children }: ClerkAuthWidgetProps) {
  return (
    <div className={styles.shell}>
      <div className={styles.shellInner}>{children}</div>
    </div>
  );
}
