/**
 * Назначение: Модальное окно полного отчёта ТП + унибоксов + насос зоны ТП.
 * Описание: Паттерн ProjectsDialog; контент — UnderfloorHeatingReportView.
 */

import { useEffect } from 'react';

import type { ParsedHydraulicsPumpProposal } from '../../types/hydraulics';
import type { ParsedUnderfloorHeating } from '../../types/underfloorHeating';
import type { ParsedUniboxesMatching } from '../../utils/parseUniboxesMatchingFromReport';
import {
  UnderfloorHeatingReportView,
  hasUnderfloorHeatingReportContent,
} from './UnderfloorHeatingReportView';
import { UniboxMatchingSection } from './UniboxMatchingSection';
import styles from './UnderfloorHeatingReportDialog.module.css';

export type UnderfloorHeatingReportDialogProps = {
  open: boolean;
  onClose: () => void;
  underfloorHeating: ParsedUnderfloorHeating | null;
  uniboxes?: ParsedUniboxesMatching | null;
  hydraulicsPumps?: readonly ParsedHydraulicsPumpProposal[] | null;
};

/**
 * @param props
 */
export function UnderfloorHeatingReportDialog({
  open,
  onClose,
  underfloorHeating,
  uniboxes = null,
  hydraulicsPumps = null,
}: UnderfloorHeatingReportDialogProps) {
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

  const hasUfh = hasUnderfloorHeatingReportContent(underfloorHeating);
  const hasUnibox =
    uniboxes != null
    && (uniboxes.byLoop.length > 0 || uniboxes.warnings.length > 0);

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
        aria-labelledby="ufh-report-dialog-title"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className={styles.header}>
          <h2 id="ufh-report-dialog-title" className={styles.title}>
            Отчёт по расчёту ТП
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

        {hasUfh && underfloorHeating != null ? (
          <UnderfloorHeatingReportView
            underfloorHeating={underfloorHeating}
            uniboxes={uniboxes}
            hydraulicsPumps={hydraulicsPumps}
          />
        ) : hasUnibox && uniboxes != null ? (
          <UniboxMatchingSection matching={uniboxes} />
        ) : (
          <p className={styles.empty}>
            Нет данных расчёта ТП. Заполните помещения с тёплым полом и дождитесь
            авторасчёта.
          </p>
        )}

        <button type="button" className={styles.closeButton} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
