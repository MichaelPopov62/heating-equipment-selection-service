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
      <h1 className={styles.title}>Не удалось инициализировать приложение</h1>
      <p className={styles.message}>
        Превышено время ожидания загрузки черновика. Попробуйте снова или обновите страницу.
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={onRetry}>
          Повторить
        </button>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => {
            window.location.reload();
          }}
        >
          Обновить страницу
        </button>
      </div>
    </div>
  );
}
