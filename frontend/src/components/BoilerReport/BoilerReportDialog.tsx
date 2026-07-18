/**
 * Призначення: модальне вікно звіту підбору котла.
 * Опис: Патерн RadiatorsReportDialog; контент — BoilerReportView.
 */

import { useEffect } from 'react';

import type { ObjectType } from '../../types/envelope';
import type { ParsedBoilerMatching } from '../../utils/parsers/parseBoilerFromReport';
import { BoilerReportView } from './BoilerReportView';
import { hasBoilerReportContent } from './hasBoilerReportContent';
import styles from './BoilerReportDialog.module.css';

export type BoilerReportDialogProps = {
  open: boolean;
  onClose: () => void;
  boiler: ParsedBoilerMatching | null;
  objectType: ObjectType;
  catalogSource?: 'file' | 'mongo' | null;
};

/**
 * @param props
 */
export function BoilerReportDialog({
  open,
  onClose,
  boiler,
  objectType,
  catalogSource = null,
}: BoilerReportDialogProps) {
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

  const hasContent = hasBoilerReportContent(boiler);

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
        aria-labelledby="boiler-report-dialog-title"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className={styles.header}>
          <h2 id="boiler-report-dialog-title" className={styles.title}>
            Отчёт по подбору котла
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

        {hasContent && boiler != null ? (
          <BoilerReportView
            boiler={boiler}
            objectType={objectType}
            catalogSource={catalogSource}
          />
        ) : (
          <p className={styles.empty}>
            Нет данных подбора котла. Заполните помещения и ограждения, задайте
            график отопления и сценарий ГВС, дождитесь авторасчёта.
          </p>
        )}

        <button type="button" className={styles.closeButton} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
