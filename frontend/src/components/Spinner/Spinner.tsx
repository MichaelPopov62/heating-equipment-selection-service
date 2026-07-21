/**
 * Назначение: Индикатор загрузки (крутящееся кольцо).
 * Описание: Центрируется в контейнере; цвета из CSS-переменных темы.
 */

import styles from './Spinner.module.css';

export type SpinnerProps = {
  /** Подпись для screen readers. */
  label?: string;
  /** Размер кольца в px (без padding контейнера). */
  size?: number;
  className?: string;
};

/**
 * @param props
 */
export function Spinner({
  label = 'Загрузка…',
  size = 32,
  className,
}: SpinnerProps) {
  const rootClass = [styles.container, className].filter(Boolean).join(' ');

  return (
    <div
      className={rootClass}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div
        className={styles.element}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    </div>
  );
}
