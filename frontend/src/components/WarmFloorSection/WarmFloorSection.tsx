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
      <h3 className={styles.title}>Тёплый пол</h3>
      <p className={styles.hint} style={{ marginTop: 0 }}>
        Выберите режим отопления. Для комбинации «тёплый пол в части комнат + радиаторы» —
        карточка <strong>«Тёплый пол + радиаторы»</strong>; ТП включается по комнатам на шаге
        «Помещения». Радиаторный график котла (75/65 или 55/45) — на шаге «Котёл».
      </p>

      <UfhPresetCards
        presets={ufhModePresets}
        selectedPresetId={ufhPresetId}
        onSelect={onUfhPresetChange}
        loading={ufhModePresetsLoading}
        error={ufhModePresetsError}
      />

      <label className={`${styles.hint} ${styles.checkboxRow}`} style={{ marginTop: 16 }}>
        <input
          type="checkbox"
          checked={waterUnderfloorHeating}
          onChange={(e) => { onWaterUnderfloorChange(e.target.checked); }}
        />
        <span>В проекте предусмотрен водяной тёплый пол (комнаты на шаге «Помещения»)</span>
      </label>
      {showDistribution && (
        <UfhDistributionSelect
          value={underfloorDistributionPreset}
          onChange={onDistributionPresetChange}
        />
      )}

      <div className={styles.reportActions}>
        <button
          type="button"
          className={styles.reportButton}
          disabled={!canOpenReport}
          onClick={() => { setReportOpen(true); }}
        >
          Отчёт по расчёту ТП
        </button>
        {!canOpenReport && (
          <p className={styles.hint} style={{ marginTop: 8 }}>
            Отчёт появится после авторасчёта с включённым ТП в помещениях.
          </p>
        )}
      </div>

      {import.meta.env.DEV && (
        <p className={styles.hint} style={{ marginTop: 10 }}>
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
