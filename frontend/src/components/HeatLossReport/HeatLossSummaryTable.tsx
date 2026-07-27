/**
 * Призначення: компактний підсумок теплопотерь для сайдбара «Результаты».
 * Опис: площа та потужність; джерело — API або швидка оцінка 100 Вт/м².
 */

import { formatAreaM2, formatKw } from '../../utils/format';
import type { ApiHeatLoss, QuickEstimate } from '../../types/recommendationsBlock';
import { RESULTS_SECTION_IDS } from '../../constants/surveyResultsSections';
import styles from './HeatLossSummaryTable.module.css';

export type HeatLossSummaryTableProps = {
  apiHeatLoss: ApiHeatLoss;
  quickEstimate: QuickEstimate;
};

/**
 * @param props
 */
export function HeatLossSummaryTable({
  apiHeatLoss,
  quickEstimate,
}: HeatLossSummaryTableProps) {
  const heatLossKw = apiHeatLoss?.heatLossKw ?? quickEstimate.heatLossKw;
  const reserveKw = apiHeatLoss?.reserveKw ?? quickEstimate.reserveKw;
  const totalHeatKw = apiHeatLoss?.totalHeatKw ?? quickEstimate.totalHeatKw;
  const sourceHint = apiHeatLoss
    ? 'Джерело: розрахунок API за огородженнями'
    : 'Джерело: швидка оцінка (100 Вт/м²)';

  return (
    <div
      id={RESULTS_SECTION_IDS.heatLoss}
      className={styles.wrap}
      aria-labelledby="heating-loss-title"
    >
      <h3 id="heating-loss-title" className={styles.title}>
        Тепловтрати
      </h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Показник</th>
              <th>Значення</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Загальна площа приміщень</td>
              <td>
                {formatAreaM2(quickEstimate.totalAreaM2)}{' '}
                <span className={styles.unit}>м²</span>
              </td>
            </tr>
            <tr>
              <td>Потужність приміщень</td>
              <td>
                {formatKw(heatLossKw, 1)}{' '}
                <span className={styles.unit}>кВт</span>
              </td>
            </tr>
            <tr>
              <td>Запас (15%)</td>
              <td>
                {formatKw(reserveKw, 1)}{' '}
                <span className={styles.unit}>кВт</span>
              </td>
            </tr>
            <tr className={styles.totalRow}>
              <td>Разом за теплом</td>
              <td>
                {formatKw(totalHeatKw, 1)}{' '}
                <span className={styles.unit}>кВт</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className={styles.hint}>{sourceHint}</p>
    </div>
  );
}
