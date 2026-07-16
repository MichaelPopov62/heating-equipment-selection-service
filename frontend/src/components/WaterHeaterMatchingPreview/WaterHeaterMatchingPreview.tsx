/**
 * Назначение: Превью подбора БКН и электробойлера.
 * Описание: Единая точка рендера карточек matching (модалка отчёта шага «Водонагреватель»).
 */

import type { WaterHeaterMatchingPreviewIdPrefix } from '../../types/waterHeaterMatching';
import type { ParsedIndirectWaterHeaterMatching } from '../../utils/parseIndirectWaterHeaterMatchingFromReport';
import type { ParsedWaterHeaterMatching } from '../../utils/parseWaterHeaterMatchingFromReport';
import { WaterHeaterProposalCard } from '../WaterHeaterProposalCard/WaterHeaterProposalCard';
import styles from './WaterHeaterMatchingPreview.module.css';

type Props = {
  indirect: ParsedIndirectWaterHeaterMatching | null;
  electric: ParsedWaterHeaterMatching | null;
  idPrefix: WaterHeaterMatchingPreviewIdPrefix;
  calcLoading?: boolean;
  /** Подсказка «после расчёта…», если карточек ещё нет. */
  showPendingHint?: boolean;
  /** Заголовок секции (в отчёте — «Результат подбора»). */
  sectionTitle?: string;
  /** embedded — с отступами секции; standalone — без внешней рамки. */
  variant?: 'embedded' | 'standalone';
};

export function WaterHeaterMatchingPreview({
  indirect,
  electric,
  idPrefix,
  calcLoading = false,
  showPendingHint = false,
  sectionTitle,
  variant = 'standalone',
}: Props) {
  const hasPreview = indirect != null || electric != null;
  const rootClass =
    variant === 'embedded' ? styles.root : styles.rootStandalone;

  return (
    <div className={rootClass}>
      {sectionTitle != null && (
        <h3 className={styles.title}>{sectionTitle}</h3>
      )}
      {calcLoading && (
        <p className={styles.pending}>Обновление подбора…</p>
      )}
      {showPendingHint && !calcLoading && !hasPreview && (
        <p className={styles.pending}>
          После расчёта здесь появятся карточки БКН и/или электробойлера.
        </p>
      )}
      {(indirect != null || electric != null) && (
        <div className={styles.cards}>
          {indirect != null && (
            <WaterHeaterProposalCard
              kind="indirect"
              title="Бойлер косвенного нагрева (БКН)"
              titleDomId={`${idPrefix}-indirect-title`}
              data={indirect}
            />
          )}
          {electric != null && (
            <WaterHeaterProposalCard
              kind="electric"
              title="Электробойлер"
              titleDomId={`${idPrefix}-electric-title`}
              data={electric}
            />
          )}
        </div>
      )}
    </div>
  );
}
