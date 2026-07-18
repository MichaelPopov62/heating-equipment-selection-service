/**
 * Призначення: модальне вікно звіту гідравліки.
 * Опис: Патерн RadiatorsReportDialog; контент — HydraulicsReportView.
 */

import { useEffect } from 'react';

import type { ParsedHydraulicsView } from '../../types/hydraulics';
import { HydraulicsReportView } from './HydraulicsReportView';
import { hasHydraulicsReportContent } from './hasHydraulicsReportContent';
import styles from './HydraulicsReportDialog.module.css';

export type HydraulicsReportDialogProps = {
  open: boolean;
  onClose: () => void;
  hydraulics: ParsedHydraulicsView | null;
  catalogSource?: 'file' | 'mongo' | null;
};

/**
 * @param props
 */
export function HydraulicsReportDialog({
  open,
  onClose,
  hydraulics,
  catalogSource = null,
}: HydraulicsReportDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const hasContent = hasHydraulicsReportContent(hydraulics);

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hydraulics-report-dialog-title"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className={styles.header}>
          <h2 id="hydraulics-report-dialog-title" className={styles.title}>
            Отчёт по гидравлике
          </h2>
          <button
            type="button"
            className={styles.closeIconButton}
            onClick={onClose}
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        {hasContent && hydraulics != null ? (
          <HydraulicsReportView
            hydraulics={hydraulics}
            catalogSource={catalogSource}
          />
        ) : (
          <p className={styles.empty}>
            Нет данных гидравлики. Заполните помещения и ограждения, задайте
            параметры разводки на шаге «Гидравлика», дождитесь авторасчёта.
          </p>
        )}

        <button type="button" className={styles.closeButton} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
