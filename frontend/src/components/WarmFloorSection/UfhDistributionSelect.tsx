/**
 * Назначение: Выбор схемы подключения контура ТП.
 * Описание: НСУ / гидрострелка / авто — heatingSystem.underfloorDistributionPreset.
 */

import { UFH_DISTRIBUTION_UI_OPTIONS } from '../../../../shared/ufhDistributionPresets.js';
import type { UfhDistributionPreset } from '../../types/ufhDistribution';
import styles from './WarmFloorSection.module.css';

type Props = {
  value: UfhDistributionPreset;
  onChange: (value: UfhDistributionPreset) => void;
  disabled?: boolean;
};

/** Селект схемы распределения ТП. */
export function UfhDistributionSelect({ value, onChange, disabled = false }: Props) {
  return (
    <div className={styles.fieldBlock}>
      <label className={styles.fieldLabel} htmlFor="ufh-distribution-preset">
        Схема подключения контура ТП
      </label>
      <select
        id="ufh-distribution-preset"
        className={styles.select}
        value={value}
        disabled={disabled}
        onChange={(e) => { onChange(e.target.value as UfhDistributionPreset); }}
      >
        {UFH_DISTRIBUTION_UI_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <p className={styles.hint}>
        При <code className={styles.inlineCode}>Авто</code> сервер выберет НСУ (квартира / малый дом)
        или гидрострелку (крупный объект, мощность котла &gt; 50 кВт).
      </p>
    </div>
  );
}
