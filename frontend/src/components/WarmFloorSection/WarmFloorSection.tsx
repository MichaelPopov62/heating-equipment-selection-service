/**
 * Назначение: Секция шага «Тёплый пол».
 * Описание: Карточки режимов ТП, флаг, схема подключения; полный отчёт — в модалке.
 */

import { useState } from 'react';

import { UfhPresetCards } from '../UfhPresetCards/UfhPresetCards';
import { UnderfloorHeatingReportDialog } from '../UnderfloorHeatingReport/UnderfloorHeatingReportDialog';
import { hasUnderfloorHeatingReportContent } from '../UnderfloorHeatingReport/hasUnderfloorHeatingReportContent';
import type { ParsedUnderfloorHeating } from '../../types/underfloorHeating';
import type { ParsedHydraulicsPumpProposal } from '../../types/hydraulics';
import type { UfhDistributionPreset } from '../../types/ufhDistribution';
import type { UfhModePresetCard, UfhModePresetId } from '../../types/ufhModePreset';
import type { ParsedUniboxesMatching } from '../../utils/parseUniboxesMatchingFromReport';
import reportActionsStyles from '../SurveyNavigation/SurveyReportActions.module.css';
import styles from './WarmFloorSection.module.css';
import { UfhDistributionSelect } from './UfhDistributionSelect';

type Props = {
  waterUnderfloorHeating: boolean;
  underfloorDistributionPreset: UfhDistributionPreset;
  ufhModePresets: UfhModePresetCard[];
  ufhModePresetsLoading?: boolean;
  ufhModePresetsError?: string | null;
  ufhPresetId: UfhModePresetId | null;
  onUfhPresetChange: (presetId: UfhModePresetId | null) => void;
  onWaterUnderfloorChange: (value: boolean) => void;
  onDistributionPresetChange: (value: UfhDistributionPreset) => void;
  underfloorHeatingReport?: ParsedUnderfloorHeating | null;
  uniboxesReport?: ParsedUniboxesMatching | null;
  /** proposal.pumps гидравлики — для зонального насоса ТП в модалке. */
  hydraulicsPumps?: readonly ParsedHydraulicsPumpProposal[] | null;
  /** Прокрутка к итогу ТП в сайдбаре «Результаты». */
  onBackToResults?: () => void;
};

/** Шаг анкеты: режим ТП (карточки), водяной тёплый пол и схема распределения. */
export function WarmFloorSection({
  waterUnderfloorHeating,
  underfloorDistributionPreset,
  ufhModePresets,
  ufhModePresetsLoading = false,
  ufhModePresetsError = null,
  ufhPresetId,
  onUfhPresetChange,
  onWaterUnderfloorChange,
  onDistributionPresetChange,
  underfloorHeatingReport = null,
  uniboxesReport = null,
  hydraulicsPumps = null,
  onBackToResults,
}: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const showDistribution =
    waterUnderfloorHeating
    && ufhPresetId != null
    && ufhPresetId !== 'ufh_only';
  const canOpenReport = hasUnderfloorHeatingReportContent(underfloorHeatingReport)
    || (uniboxesReport != null
      && (uniboxesReport.byLoop.length > 0 || uniboxesReport.warnings.length > 0));

  return (
    <div className={styles.root}>
      <h3 className={styles.title}>Тепла підлога</h3>
      <p className={`${styles.hint} ${styles.hintMt0}`}>
        Оберіть режим опалення. Для комбінації «тепла підлога в частині кімнат + радіатори» —
        картка <strong>«Тепла підлога + радіатори»</strong>; ТП вмикається по кімнатах на кроці
        «Приміщення». Радіаторний графік котла (75/65 або 55/45) — на кроці «Котел».
      </p>

      <UfhPresetCards
        presets={ufhModePresets}
        selectedPresetId={ufhPresetId}
        onSelect={onUfhPresetChange}
        loading={ufhModePresetsLoading}
        error={ufhModePresetsError}
      />

      <label className={`${styles.hint} ${styles.checkboxRow} ${styles.hintMt16}`}>
        <input
          type="checkbox"
          checked={waterUnderfloorHeating}
          onChange={(e) => { onWaterUnderfloorChange(e.target.checked); }}
        />
        <span>У проєкті передбачена водяна тепла підлога (кімнати на кроці «Приміщення»)</span>
      </label>
      {showDistribution && (
        <UfhDistributionSelect
          value={underfloorDistributionPreset}
          onChange={onDistributionPresetChange}
        />
      )}

      <div className={reportActionsStyles.reportActions}>
        <div className={reportActionsStyles.reportActionsRow}>
          <button
            type="button"
            className={reportActionsStyles.reportButton}
            disabled={!canOpenReport}
            onClick={() => { setReportOpen(true); }}
          >
            Звіт з розрахунку ТП
          </button>
          {onBackToResults != null && (
            <button
              type="button"
              className={reportActionsStyles.backButton}
              onClick={onBackToResults}
            >
              Назад до результатів
            </button>
          )}
        </div>
        {!canOpenReport && (
          <p className={`${styles.hint} ${styles.hintMt8}`}>
            Звіт з&apos;явиться після авторозрахунку з увімкненим ТП у приміщеннях.
          </p>
        )}
      </div>

      {import.meta.env.DEV && (
        <p className={`${styles.hint} ${styles.hintMt10}`}>
          Поля API:{' '}
          <code className={styles.inlineCode}>heatingSystem.ufhPresetId</code>,{' '}
          <code className={styles.inlineCode}>heatingSystem.waterUnderfloorHeating</code>,{' '}
          <code className={styles.inlineCode}>heatingSystem.underfloorDistributionPreset</code>.
        </p>
      )}

      <UnderfloorHeatingReportDialog
        open={reportOpen}
        onClose={() => { setReportOpen(false); }}
        underfloorHeating={underfloorHeatingReport}
        uniboxes={uniboxesReport}
        hydraulicsPumps={hydraulicsPumps}
      />
    </div>
  );
}
