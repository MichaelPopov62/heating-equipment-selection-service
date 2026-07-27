/**
 * Назначение: Карточка подбора водонагревателя.
 * Описание: Отображение БКН или электробойлера из matching-узла отчёта расчёта.
 */

import {
  formatBrandModel,
  formatKw,
  formatLiters,
  formatPriceUah,
} from '../../utils/format';
import type { WaterHeaterProposalCardProps } from '../../types/waterHeaterMatching';
import styles from './WaterHeaterProposalCard.module.css';

export function WaterHeaterProposalCard(props: WaterHeaterProposalCardProps) {
  const { title, titleDomId, data, kind } = props;

  const cardClass =
    kind === 'electric'
      ? `${styles.card} ${styles.cardElectric}`
      : styles.card;

  return (
    <div className={cardClass} aria-labelledby={titleDomId}>
      <h4 className={styles.title} id={titleDomId}>
        {title}
      </h4>
      {data.hasCatalogSelection ? (
        <dl className={styles.dl}>
          <dt>Модель (підбір)</dt>
          <dd className={styles.valueStrong}>
            {data.selectedModel
              ? formatBrandModel(data.brand, data.selectedModel)
              : '—'}
          </dd>
          {data.volumeLiters != null && (
            <>
              <dt>Об&apos;єм бака</dt>
              <dd>
                {formatLiters(data.volumeLiters)}{' '}
                <span className={styles.unit}>л</span>
              </dd>
            </>
          )}
          {data.requiredTankLiters > 0 && (
            <>
              <dt>Розрахунковий мінімум (підбір)</dt>
              <dd>
                {formatLiters(data.requiredTankLiters)}{' '}
                <span className={styles.unit}>л</span>
              </dd>
            </>
          )}
          {kind === 'indirect' && (
            <>
              {data.coilPowerKw != null && (
                <>
                  <dt>Потужність змійовика (каталог)</dt>
                  <dd>
                    {formatKw(data.coilPowerKw, 1)}{' '}
                    <span className={styles.unit}>кВт</span>
                  </dd>
                </>
              )}
              {data.effectiveHeatPowerKw != null && (
                <>
                  <dt>Ефективна потужність нагріву (мін. котел, змійовик)</dt>
                  <dd>
                    {formatKw(data.effectiveHeatPowerKw)}{' '}
                    <span className={styles.unit}>кВт</span>
                  </dd>
                </>
              )}
              <dt>Час повного нагріву бака (оцінка)</dt>
              <dd>
                {data.heatTimeMinutesFullTank != null ? (
                  <>
                    ~{data.heatTimeMinutesFullTank}{' '}
                    <span className={styles.unit}>хв</span>
                    <span className={styles.hintInline}>
                      {' '}
                      за пріоритету ГВП і зазначеної ефективної потужності; не норматив.
                    </span>
                  </>
                ) : (
                  '— (немає даних про потужність котла/змійовика)'
                )}
              </dd>
            </>
          )}
          {kind === 'electric' && data.powerKw != null && (
            <>
              <dt>Потужність нагріву (каталог)</dt>
              <dd>
                {formatKw(data.powerKw, 1)}{' '}
                <span className={styles.unit}>кВт</span>
              </dd>
            </>
          )}
          {data.price != null && (
            <>
              <dt>Ціна в каталозі</dt>
              <dd className={styles.valueStrong}>
                {formatPriceUah(data.price)}{' '}
                <span className={styles.unit}>грн</span>
              </dd>
            </>
          )}
        </dl>
      ) : (
        <p className={styles.emptyHint}>
          {kind === 'indirect'
            ? (data.skippedReason ?? 'БКН з каталогу не обрано.')
            : 'Електробойлер з каталогу не обрано.'}
        </p>
      )}
      {data.warnings.length > 0 && (
        <ul className={styles.warningsList}>
          {data.warnings.map((w, i) => (
            <li key={`wh-w-${i}-${w.slice(0, 96)}`}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
