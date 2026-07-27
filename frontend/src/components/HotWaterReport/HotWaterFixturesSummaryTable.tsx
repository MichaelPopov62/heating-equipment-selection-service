/**
 * Назначение: Сводка точек водоразбора ГВ для сайдбара «Результаты».
 * Описание: Live из hotWaterForm.fixtures; детали расчёта — в модалке шага «Горячая вода».
 */

import type { HotWaterFormFixtures } from '../../types/hotWater';
import { RESULTS_SECTION_IDS } from '../../constants/surveyResultsSections';
import { hasHotWaterFixturesContent } from '../../utils/countThermalFixtures';
import { SurveyStepLink } from '../SurveyNavigation/SurveyStepLink';
import { HotWaterFixturesTable } from './HotWaterFixturesTable';
import styles from './HotWaterFixturesSummaryTable.module.css';

export type HotWaterFixturesSummaryTableProps = {
  fixtures: HotWaterFormFixtures;
};

/**
 * @param props
 */
export function HotWaterFixturesSummaryTable({
  fixtures,
}: HotWaterFixturesSummaryTableProps) {
  if (!hasHotWaterFixturesContent(fixtures)) {
    return null;
  }

  return (
    <div
      id={RESULTS_SECTION_IDS.hotWater}
      className={styles.wrap}
      aria-labelledby="hot-water-fixtures-summary-title"
    >
      <h3 id="hot-water-fixtures-summary-title" className={styles.title}>
        Точки водоразбора (ГВ)
      </h3>
      <HotWaterFixturesTable fixtures={fixtures} />
      <p className={styles.hint}>
        Значення з анкети кроку{' '}
        <SurveyStepLink step="hotWater">«Гаряча вода»</SurveyStepLink>
        ; при зміні анкети таблиця оновлюється одразу. Повний розрахунок витрати та
        потужності — у звіті на тому ж кроці (після авторасчунку).
      </p>
    </div>
  );
}
