/**
 * Назначение: fallback поки lazy-завантажується Clerk SDK.
 * Без Footer/AppChrome — рендериться поза AppChromeProvider у ClerkLazyRoot.
 */

import { Spinner } from '../Spinner/Spinner';
import styles from './ClerkAuthLoadingFallback.module.css';

export type ClerkAuthLoadingFallbackProps = {
  statusLabel?: string;
};

/**
 * @param props
 */
export function ClerkAuthLoadingFallback({
  statusLabel = 'Завантаження автентифікації…',
}: ClerkAuthLoadingFallbackProps) {
  return (
    <div className={styles.root} role="status" aria-live="polite" aria-busy="true">
      <Spinner label={statusLabel} size={40} />
      <p className={styles.label}>{statusLabel}</p>
    </div>
  );
}
