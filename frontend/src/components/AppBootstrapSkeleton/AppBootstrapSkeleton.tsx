/**
 * Назначение: UI фазы resolving (bootstrap).
 * Описание: Каркас Start Screen с Logo, Spinner и Footer; без форм и calc.
 */

import Logo from '../Logo/Logo';
import { Footer } from '../Footer/Footer';
import { Spinner } from '../Spinner/Spinner';
import styles from './AppBootstrapSkeleton.module.css';

export type AppBootstrapSkeletonProps = {
  statusLabel?: string;
};

/**
 * @param props
 */
export function AppBootstrapSkeleton({
  statusLabel = 'Загрузка приложения…',
}: AppBootstrapSkeletonProps) {
  return (
    <div className={styles.root} role="status" aria-live="polite" aria-busy="true">
      <span className={styles.visuallyHidden}>{statusLabel}</span>

      <header className={styles.headerSkeleton} aria-hidden="true">
        <div className={styles.logoBlock} />
        <div className={styles.titleBlock} />
        <div className={styles.actionsBlock}>
          <div className={styles.chip} />
          <div className={styles.chip} />
        </div>
      </header>

      <main className={styles.main} aria-hidden="true">
        <Logo size={40} />
        <div className={styles.lineWide} />
        <div className={styles.lineMedium} />
        <Spinner label={statusLabel} />
      </main>

      <Footer variant="app" />
    </div>
  );
}
