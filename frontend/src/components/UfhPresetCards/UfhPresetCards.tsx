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
    return <p className={styles.hint}>Завантаження режимів теплої підлоги…</p>;
  }

  return (
    <div className={styles.root}>
      {error != null && (
        <p className={styles.error} role="status">
          {error} — показано локальні підписи.
        </p>
      )}
      <div className={styles.grid} role="radiogroup" aria-label="Режим опалення">
        <button
          type="button"
          className={`${styles.card} ${selectedPresetId == null ? styles.cardSelected : ''}`}
          onClick={() => { onSelect(null); }}
        >
          <span className={styles.cardTitle}>Лише радіатори</span>
          <span className={styles.cardBadge}>Класика</span>
          <span className={styles.cardDesc}>
            Водяна тепла підлога не обрана як режим опалення.
          </span>
        </button>
        {ufhPresetCardsForUi(presets).map((p) => (
          <button
            key={p.presetId}
            type="button"
            className={`${styles.card} ${selectedPresetId === p.presetId ? styles.cardSelected : ''}`}
            onClick={() => { onSelect(p.presetId); }}
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
