/**
 * Назначение: Карточки выбора режима тёплого пола (UI из Mongo).
 */

import type { UfhModePresetCard, UfhModePresetId } from '../../types/ufhModePreset';
import { ufhPresetCardsForUi } from '../../utils/ufhPresetCardsForUi';
import styles from './UfhPresetCards.module.css';

type Props = {
  presets: UfhModePresetCard[];
  selectedPresetId: UfhModePresetId | null;
  onSelect: (presetId: UfhModePresetId | null) => void;
  loading?: boolean;
  error?: string | null;
};

/** Карточки режимов ТП: title, badge, description из API. */
export function UfhPresetCards({
  presets,
  selectedPresetId,
  onSelect,
  loading = false,
  error = null,
}: Props) {
  if (loading) {
    return <p className={styles.hint}>Загрузка режимов тёплого пола…</p>;
  }

  return (
    <div className={styles.root}>
      {error != null && (
        <p className={styles.error} role="status">
          {error} — показаны локальные подписи.
        </p>
      )}
      <div className={styles.grid} role="radiogroup" aria-label="Режим отопления">
        <button
          type="button"
          className={`${styles.card} ${selectedPresetId == null ? styles.cardSelected : ''}`}
          onClick={() => onSelect(null)}
        >
          <span className={styles.cardTitle}>Только радиаторы</span>
          <span className={styles.cardBadge}>Классика</span>
          <span className={styles.cardDesc}>
            Водяной тёплый пол не выбран как режим отопления.
          </span>
        </button>
        {ufhPresetCardsForUi(presets, selectedPresetId).map((p) => (
          <button
            key={p.presetId}
            type="button"
            className={`${styles.card} ${selectedPresetId === p.presetId ? styles.cardSelected : ''}`}
            onClick={() => onSelect(p.presetId)}
          >
            <span className={styles.cardTitle}>{p.ui.title}</span>
            <span className={styles.cardBadge}>{p.ui.badge}</span>
            <span className={styles.cardDesc}>{p.ui.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
