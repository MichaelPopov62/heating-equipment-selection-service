/**
 * Назначение: Компонент подвала приложения.
 * Описание: Отображает версию приложения и пометку о методике расчёта (MVP).
 */

import styles from './Footer.module.css';

export type FooterProps = {
  version: string;
};

export function Footer({ version }: FooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.left}>
          <span className={styles.version}>{version}</span>
          <span className={styles.separator} aria-hidden="true">
            |
          </span>
          <span className={styles.note}>Расчет по СНиП (MVP)</span>
        </div>
        <div className={styles.right}>© 2026</div>
      </div>
    </footer>
  );
}

