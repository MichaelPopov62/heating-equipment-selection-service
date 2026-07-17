/**
 * Назначение: Модалка шагов устранения предупреждения ТП.
 * Описание: Именованные решения из recommendations.resolutionSteps
 * (завоздушивание, паразитный q↓, смесительный узел, лимит Tповерх пресета).
 */

import { useEffect } from 'react';
import type { ParsedUfhResolutionStep } from '../../types/underfloorHeating';
import styles from './UfhWarningResolutionDialog.module.css';

export type UfhWarningResolutionDialogProps = {
  open: boolean;
  onClose: () => void;
  steps: readonly ParsedUfhResolutionStep[];
};

/**
 * @param props
 */
export function UfhWarningResolutionDialog({
  open,
  onClose,
  steps,
}: UfhWarningResolutionDialogProps) {
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
        aria-labelledby="ufh-warning-resolution-title"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className={styles.header}>
          <h2 id="ufh-warning-resolution-title" className={styles.title}>
            Устранение предупреждения
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

        {steps.length > 0 ? (
          <ol className={styles.steps}>
            {steps.map((step, i) => (
              <li key={`ufh-res-step-${i}`} className={styles.stepItem}>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDetail}>{step.detail}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.hint}>Шаги устранения не заданы в справочнике.</p>
        )}

        <div className={styles.footer}>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
