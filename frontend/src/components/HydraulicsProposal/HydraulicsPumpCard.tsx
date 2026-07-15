/**
 * Назначение: Карточка предложения циркуляционного насоса.
 * Описание: Общий UI для гидравлики (Итог) и зонального насоса в отчёте ТП.
 */

import type { ParsedHydraulicsPumpProposal } from '../../types/hydraulics';
import { formatBrandModel, formatPriceUah } from '../../utils/format';
import styles from './HydraulicsPumpCard.module.css';

type Props = {
  pump: ParsedHydraulicsPumpProposal;
};

/**
 * @param props
 */
export function HydraulicsPumpCard({ pump }: Props) {
  return (
    <div className={styles.pumpCard} aria-labelledby={`hyd-pump-${pump.zoneId}`}>
      <h4 id={`hyd-pump-${pump.zoneId}`} className={styles.subTitle}>
        {pump.zoneLabel}
      </h4>
      {pump.note && <p className={styles.hint}>{pump.note}</p>}
      <dl className={styles.dl}>
        <dt>{pump.pumpSource === 'boiler_builtin' ? 'Котёл' : 'Модель'}</dt>
        <dd className={styles.valueStrong}>
          {formatBrandModel(pump.brand, pump.model)}
        </dd>
        <dt>Расчётный расход</dt>
        <dd>
          {pump.designFlowM3PerHour.toFixed(3)}{' '}
          <span className={styles.unit}>м³/ч</span>
        </dd>
        <dt>Режим работы</dt>
        <dd>{pump.modeName}</dd>
        <dt>Напор при расчётном расходе</dt>
        <dd>
          {pump.headAtDesignM.toFixed(2)} <span className={styles.unit}>м</span>{' '}
          <span className={styles.hintInline}>
            (запас {pump.headMarginPercent.toFixed(1)} %)
          </span>
        </dd>
        {pump.connectionNominalMm != null && (
          <>
            <dt>Условный диаметр подключения</dt>
            <dd>DN{pump.connectionNominalMm}</dd>
          </>
        )}
        {pump.price > 0 && (
          <>
            <dt>Цена в каталоге</dt>
            <dd className={styles.valueStrong}>
              {formatPriceUah(pump.price)}{' '}
              <span className={styles.unit}>грн</span>
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
