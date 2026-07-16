/**
 * Назначение: Модальное окно полного отчёта ГВС.
 * Описание: Точки из анкеты всегда; расчёт API — когда есть; без блокировки точек calc-ом.
 */

import { useEffect } from 'react';

import type { HotWaterFormValue } from '../../types/hotWater';
import type { ParsedHotWaterReport } from '../../types/hotWaterReport';
import { hasHotWaterFixturesContent } from '../../utils/countThermalFixtures';
import { normalizeHotWaterForm } from '../../utils/normalizeHotWaterForm';
import { HotWaterReportView } from './HotWaterReportView';
import { hasHotWaterReportContent } from './hasHotWaterReportContent';
import styles from './HotWaterReportDialog.module.css';

export type HotWaterReportDialogProps = {
  open: boolean;
  onClose: () => void;
  hotWater: ParsedHotWaterReport | null;
  /** Анкета ГВ — обязательна для таблицы точек. */
  formValue: HotWaterFormValue;
};

/**
 * @param props
 */
export function HotWaterReportDialog({
  open,
  onClose,
  hotWater,
  formValue,
}: HotWaterReportDialogProps) {
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

  const form = normalizeHotWaterForm(formValue);
  const hasFixtures = hasHotWaterFixturesContent(form.fixtures);
  const hasCalc = hasHotWaterReportContent(hotWater);
  const hasAnything = hasFixtures || hasCalc;

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
        aria-labelledby="hot-water-report-dialog-title"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className={styles.header}>
          <h2 id="hot-water-report-dialog-title" className={styles.title}>
            Отчёт по расчёту ГВ
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

        {hasAnything ? (
          <HotWaterReportView
            hotWater={hasCalc ? hotWater : null}
            formValue={form}
          />
        ) : (
          <p className={styles.empty}>
            Укажите точки водоразбора на шаге «Горячая вода». Расчётные
            показатели появятся после авторасчёта.
          </p>
        )}

        <button type="button" className={styles.closeButton} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}
