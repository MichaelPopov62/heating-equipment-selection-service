/**
 * Назначение: уведомление после копирования публичной ссылки в буфер.
 * Описание: URL на экране не показывается — только инструкция для мессенджера.
 */

import { useEffect } from 'react';

import styles from './ShareLinkToast.module.css';

const AUTO_DISMISS_MS = 10_000;

export type ShareLinkToastProps = {
  open: boolean;
  onDismiss: () => void;
};

/**
 * @param props
 */
export function ShareLinkToast({ open, onDismiss }: ShareLinkToastProps) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <button
        type="button"
        className={styles.close}
        onClick={onDismiss}
        aria-label="Закрыть уведомление"
      >
        ×
      </button>
      <p className={styles.title}>✓ Ссылка скопирована</p>
      <p className={styles.body}>
        Вставьте её в WhatsApp, Telegram или другой мессенджер (Ctrl+V).
      </p>
    </div>
  );
}
