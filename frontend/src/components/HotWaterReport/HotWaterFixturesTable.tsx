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

const WASHING_MACHINE_ROW_LABEL =
  '\u041F\u0440\u0430\u043B\u043D\u0430 \u043C\u0430\u0448\u0438\u043D\u0430 (\u0442\u0435\u0445\u043F\u0440\u0438\u043C\u0456\u0449\u0435\u043D\u043D\u044F)';

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
            <th scope="row">Раковина (санвузол)</th>
            <td>{fx.sink}</td>
          </tr>
          <tr>
            <th scope="row">Унітаз</th>
            <td>{fx.toilet}</td>
          </tr>
          <tr>
            <th scope="row">Біде</th>
            <td>{fx.bidet}</td>
          </tr>
          <tr>
            <th scope="row">Кухня — мийка / змішувач</th>
            <td>{fx.kitchenSink}</td>
          </tr>
          <tr>
            <th scope="row">Кухня — посудомийна машина</th>
            <td>{fx.dishwasher}</td>
          </tr>
          <tr>
            <th scope="row">Мийка (побутовий блок)</th>
            <td>{fx.laundrySink}</td>
          </tr>
          <tr>
            <th scope="row">{WASHING_MACHINE_ROW_LABEL}</th>
            <td>{fx.washingMachine}</td>
          </tr>
          <tr className={styles.totalRow}>
            <th scope="row">Разом точок з витратою ГВ (для розрахунку піку)</th>
            <td>{thermalTotal}</td>
          </tr>
          <tr className={styles.totalRow}>
            <th scope="row">Усього врахованих точок (з унітазом)</th>
            <td>{allPointsTotal}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
