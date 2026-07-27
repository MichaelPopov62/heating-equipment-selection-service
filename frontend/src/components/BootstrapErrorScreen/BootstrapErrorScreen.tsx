/**
 * Назначение: UI ошибки bootstrap (timeout / сбой resolve).
 */

import styles from './BootstrapErrorScreen.module.css';

export type BootstrapErrorScreenProps = {
  onRetry: () => void;
};

/**
 * @param props
 */
export function BootstrapErrorScreen({ onRetry }: BootstrapErrorScreenProps) {
  return (
    <div className={styles.root} role="alert">
      <h1 className={styles.title}>Не вдалося ініціалізувати застосунок</h1>
      <p className={styles.message}>
        Перевищено час очікування завантаження чернетки. Спробуйте знову або оновіть сторінку.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onRetry}>
          Повторити
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            window.location.reload();
          }}
        >
          Оновити сторінку
        </button>
      </div>
    </div>
  );
}
