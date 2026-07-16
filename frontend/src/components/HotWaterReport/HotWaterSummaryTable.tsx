/**
 * Назначение: Агрегат подбора ЭБ/БКН для сайдбара «Итог».
 * Описание: Две строки; детали потребления — модалка ГВ; карточки — модалка водонагревателя.
 */

import type { HotWaterBoilerPowerMatchingScheme } from '../../types/heatingMatching';
import type { ParsedHotWaterReport } from '../../types/hotWaterReport';
import type { ParsedIndirectWaterHeaterMatching } from '../../utils/parseIndirectWaterHeaterMatchingFromReport';
import type { ParsedWaterHeaterMatching } from '../../utils/parseWaterHeaterMatchingFromReport';
import {
  hasHotWaterEquipmentWarnings,
  isHotWaterEquipmentSchemeParticipant,
  resolveHotWaterEquipmentRowLabel,
} from '../../utils/hotWaterEquipmentParticipation';
import { hasHotWaterSummaryContent } from './hasHotWaterSummaryContent';
import { RESULTS_SECTION_IDS } from '../../constants/surveyResultsSections';
import { SurveyStepLink } from '../SurveyNavigation/SurveyStepLink';
import styles from './HotWaterSummaryTable.module.css';

export type HotWaterSummaryTableProps = {
  scheme: HotWaterBoilerPowerMatchingScheme;
  hotWater: ParsedHotWaterReport | null;
  electric: ParsedWaterHeaterMatching | null;
  indirect: ParsedIndirectWaterHeaterMatching | null;
  calcLoading?: boolean;
};

/**
 * @param props
 */
export function HotWaterSummaryTable({
  scheme,
  hotWater,
  electric,
  indirect,
  calcLoading = false,
}: HotWaterSummaryTableProps) {
  if (!hasHotWaterSummaryContent(hotWater, electric, indirect)) {
    return null;
  }

  const hasReport = hotWater != null;
  const electricLabel = resolveHotWaterEquipmentRowLabel({
    kind: 'electric',
    scheme,
    matching: electric,
    hasReport,
  });
  const indirectLabel = resolveHotWaterEquipmentRowLabel({
    kind: 'indirect',
    scheme,
    matching: indirect,
    hasReport,
  });
  const hasWarnings = hasHotWaterEquipmentWarnings(electric, indirect);

  const electricNotParticipating =
    !isHotWaterEquipmentSchemeParticipant(scheme, 'electric')
    && electricLabel.startsWith('Не участвует');
  const indirectNotParticipating =
    !isHotWaterEquipmentSchemeParticipant(scheme, 'indirect')
    && indirectLabel.startsWith('Не участвует');

  return (
    <div
      id={RESULTS_SECTION_IDS.waterHeater}
      className={styles.wrap}
      aria-labelledby="hot-water-summary-title"
    >
      <h3 id="hot-water-summary-title" className={styles.title}>
        Водонагреватель (итог)
      </h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Оборудование</th>
              <th>Результат подбора</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Электробойлер (ЭБ)</td>
              <td className={electricNotParticipating ? styles.notParticipating : undefined}>
                {electricLabel}
              </td>
            </tr>
            <tr>
              <td>Бойлер косвенного нагрева (БКН)</td>
              <td className={indirectNotParticipating ? styles.notParticipating : undefined}>
                {indirectLabel}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {calcLoading && (
        <p className={styles.hint} role="status">
          Обновление подбора…
        </p>
      )}
      <p className={styles.hint}>
        Детали расчёта потребления — на шаге{' '}
        <SurveyStepLink step="hotWater">«Горячая вода»</SurveyStepLink>
        . Схема котёл/ГВС и карточки номенклатуры — в отчёте на шаге{' '}
        <SurveyStepLink step="waterHeater">«Водонагреватель»</SurveyStepLink>
        .
      </p>
      {hasWarnings && (
        <p className={styles.attention}>
          Обратите внимание на предупреждения подбора в отчёте на шаге{' '}
          <SurveyStepLink step="waterHeater">«Водонагреватель»</SurveyStepLink>
          .
        </p>
      )}
    </div>
  );
}
