/**
 * Назначение: Таблица точек водоразбора из анкеты ГВС.
 * Описание: Единый UI для модалки отчёта и сайдбара «Результаты»; всегда нормализованные числа.
 */

import type { HotWaterFormFixtures } from '../../types/hotWater';
import { countThermalFixtures } from '../../utils/countThermalFixtures';
import { normalizeHotWaterFixtures } from '../../utils/normalizeHotWaterForm';
import styles from './HotWaterFixturesTable.module.css';

export type HotWaterFixturesTableProps = {
  fixtures: HotWaterFormFixtures;
};

/**
 * @param props
 */
export function HotWaterFixturesTable({ fixtures }: HotWaterFixturesTableProps) {
  const fx = normalizeHotWaterFixtures(fixtures);
  const thermalTotal = countThermalFixtures(fx);
  const allPointsTotal = thermalTotal + fx.toilet;

  return (
    <div className={styles.tableWrap}>
      <table className={styles.fixturesTable}>
        <tbody>
          <tr>
            <th scope="row">Душ</th>
            <td>{fx.shower}</td>
          </tr>
          <tr>
            <th scope="row">Ванна</th>
            <td>{fx.bath}</td>
          </tr>
          <tr>
            <th scope="row">Раковина (санузел)</th>
            <td>{fx.sink}</td>
          </tr>
          <tr>
            <th scope="row">Унитаз</th>
            <td>{fx.toilet}</td>
          </tr>
          <tr>
            <th scope="row">Биде</th>
            <td>{fx.bidet}</td>
          </tr>
          <tr>
            <th scope="row">Кухня — мойка / смеситель</th>
            <td>{fx.kitchenSink}</td>
          </tr>
          <tr>
            <th scope="row">Кухня — посудомоечная машина</th>
            <td>{fx.dishwasher}</td>
          </tr>
          <tr>
            <th scope="row">Мойка (хозблок)</th>
            <td>{fx.laundrySink}</td>
          </tr>
          <tr>
            <th scope="row">Стиральная машина (техпомещение)</th>
            <td>{fx.washingMachine}</td>
          </tr>
          <tr className={styles.totalRow}>
            <th scope="row">Итого точек с расходом ГВ (для расчёта пика)</th>
            <td>{thermalTotal}</td>
          </tr>
          <tr className={styles.totalRow}>
            <th scope="row">Всего учтённых точек (с унитазом)</th>
            <td>{allPointsTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
