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
          <dt>Модель (подбор)</dt>
          <dd className={styles.valueStrong}>
            {data.selectedModel
              ? formatBrandModel(data.brand, data.selectedModel)
              : '—'}
          </dd>
          {data.volumeLiters != null && (
            <>
              <dt>Объём бака</dt>
              <dd>
                {formatLiters(data.volumeLiters)}{' '}
                <span className={styles.unit}>л</span>
              </dd>
            </>
          )}
          {data.requiredTankLiters > 0 && (
            <>
              <dt>Расчётный минимум (подбор)</dt>
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
                  <dt>Мощность змеевика (каталог)</dt>
                  <dd>
                    {formatKw(data.coilPowerKw, 1)}{' '}
                    <span className={styles.unit}>кВт</span>
                  </dd>
                </>
              )}
              {data.effectiveHeatPowerKw != null && (
                <>
                  <dt>Эффективная мощность нагрева (min котёл, змеевик)</dt>
                  <dd>
                    {formatKw(data.effectiveHeatPowerKw)}{' '}
                    <span className={styles.unit}>кВт</span>
                  </dd>
                </>
              )}
              <dt>Время полного нагрева бака (оценка)</dt>
              <dd>
                {data.heatTimeMinutesFullTank != null ? (
                  <>
                    ~{data.heatTimeMinutesFullTank}{' '}
                    <span className={styles.unit}>мин</span>
                    <span className={styles.hintInline}>
                      {' '}
                      при приоритете ГВС и указанной эффективной мощности; не норматив.
                    </span>
                  </>
                ) : (
                  '— (нет данных по мощности котла/змеевика)'
                )}
              </dd>
            </>
          )}
          {kind === 'electric' && data.powerKw != null && (
            <>
              <dt>Мощность нагрева (каталог)</dt>
              <dd>
                {formatKw(data.powerKw, 1)}{' '}
                <span className={styles.unit}>кВт</span>
              </dd>
            </>
          )}
          {data.price != null && (
            <>
              <dt>Цена в каталоге</dt>
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
            ? (data.skippedReason ?? 'БКН из каталога не выбран.')
            : 'Электробойлер из каталога не выбран.'}
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
