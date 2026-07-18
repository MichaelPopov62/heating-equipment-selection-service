/**
 * Призначення: модальне вікно звіту підбору радіаторів.
 * Опис: Патерн WaterHeaterReportDialog; контент — RadiatorsReportView.
 */

import { useEffect } from 'react';

import type { ParsedRadiatorsMatching } from '../../utils/parseRadiatorsMatchingFromReport';
import { RadiatorsReportView } from './RadiatorsReportView';
import { hasRadiatorsReportContent } from './hasRadiatorsReportContent';
import styles from './RadiatorsReportDialog.module.css';

export type RadiatorsReportDialogProps = {
  open: boolean;
  onClose: () => void;
  radiators: ParsedRadiatorsMatching | null;
};

/**
 * @param props
 */
export function RadiatorsReportDialog({
  open,
  onClose,
  radiators,
}: RadiatorsReportDialogProps) {
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

  const hasContent = hasRadiatorsReportContent(radiators);

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
        aria-labelledby="radiators-report-dialog-title"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className={styles.header}>
          <h2 id="radiators-report-dialog-title" className={styles.title}>
            Отчёт по расчёту радиаторов
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

        {hasContent && radiators != null ? (
          <RadiatorsReportView radiators={radiators} />
        ) : (
          <p className={styles.empty}>
            Нет данных подбора радиаторов. Заполните помещения и ограждения,
            задайте подводку и тип приборов, дождитесь авторасчёта. При режиме
            «только тёплый пол» (ufh_only) подбор радиаторов пропускается.
          </p>
        )}

        <button type="button" className={styles.closeButton} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
