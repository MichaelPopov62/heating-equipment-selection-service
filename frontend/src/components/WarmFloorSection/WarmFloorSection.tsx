/**
 * Назначение: Секция шага «Тёплый пол».
 * Описание: Карточки режимов ТП из Mongo, флаг водяного ТП и схема подключения.
 */

import { UfhPresetCards } from '../UfhPresetCards/UfhPresetCards';
import type { UfhDistributionPreset } from '../../types/ufhDistribution';
import type { UfhModePresetCard, UfhModePresetId } from '../../types/ufhModePreset';
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
}: Props) {
  const showDistribution =
    waterUnderfloorHeating
    && ufhPresetId != null
    && ufhPresetId !== 'ufh_only';

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
          onChange={(e) => onWaterUnderfloorChange(e.target.checked)}
        />
        <span>В проекте предусмотрен водяной тёплый пол (комнаты на шаге «Помещения»)</span>
      </label>
      {showDistribution && (
        <UfhDistributionSelect
          value={underfloorDistributionPreset}
          onChange={onDistributionPresetChange}
        />
      )}
      <p className={styles.hint} style={{ marginTop: 10 }}>
        Поля API:{' '}
        <code className={styles.inlineCode}>heatingSystem.ufhPresetId</code>,{' '}
        <code className={styles.inlineCode}>heatingSystem.waterUnderfloorHeating</code>,{' '}
        <code className={styles.inlineCode}>heatingSystem.underfloorDistributionPreset</code>.
      </p>
    </div>
  );
}
