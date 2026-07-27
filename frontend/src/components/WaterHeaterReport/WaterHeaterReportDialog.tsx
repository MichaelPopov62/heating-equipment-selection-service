/**
 * Назначение: Модальное окно отчёта подбора водонагревателя.
 * Описание: Паттерн HotWaterReportDialog; контент — WaterHeaterReportView.
 */

import { useEffect } from 'react';

import type { ParsedIndirectWaterHeaterMatching } from '../../utils/parseIndirectWaterHeaterMatchingFromReport';
import type { ParsedWaterHeaterMatching } from '../../utils/parseWaterHeaterMatchingFromReport';
import { WaterHeaterReportView } from './WaterHeaterReportView';
import { hasWaterHeaterReportContent } from './hasWaterHeaterReportContent';
import styles from './WaterHeaterReportDialog.module.css';

export type WaterHeaterReportDialogProps = {
  open: boolean;
  onClose: () => void;
  indirect: ParsedIndirectWaterHeaterMatching | null;
  electric: ParsedWaterHeaterMatching | null;
};

/**
 * @param props
 */
export function WaterHeaterReportDialog({
  open,
  onClose,
  indirect,
  electric,
}: WaterHeaterReportDialogProps) {
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

  const hasContent = hasWaterHeaterReportContent(indirect, electric);

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
        aria-labelledby="water-heater-report-dialog-title"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className={styles.header}>
          <h2 id="water-heater-report-dialog-title" className={styles.title}>
            Звіт з підбору водонагрівача
          </h2>
          <button
            type="button"
            className={styles.closeIconButton}
            onClick={onClose}
            aria-label="Закрити"
          >
            ✕
          </button>
        </div>

        {hasContent ? (
          <WaterHeaterReportView indirect={indirect} electric={electric} />
        ) : (
          <p className={styles.empty}>
            Немає даних підбору. Оберіть схему на кроці «Водонагрівач» та
            дочекайтеся авторозрахунку.
          </p>
        )}

        <button type="button" className={styles.closeButton} onClick={onClose}>
          Закрити
        </button>
      </div>
    </div>
  );
}
