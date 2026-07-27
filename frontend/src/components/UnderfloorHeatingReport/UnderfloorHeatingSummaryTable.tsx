/**
 * Назначение: Агрегат ТП + унибоксов + насос ТП для сайдбара «Итог».
 * Описание: Только ключевые цифры; детали — в модалке шага ТП.
 */

import type { ParsedUnderfloorHeating } from '../../types/underfloorHeating';
import type { ParsedHydraulicsPumpProposal } from '../../types/hydraulics';
import type { ParsedUniboxesMatching } from '../../utils/parseUniboxesMatchingFromReport';
import { formatKw } from '../../utils/format';
import {
  selectUfhZonePumps,
  ufhPumpSummaryLabel,
} from '../../utils/ufhHydraulicsPumps';
import { hasUnderfloorHeatingReportContent } from './hasUnderfloorHeatingReportContent';
import { RESULTS_SECTION_IDS } from '../../constants/surveyResultsSections';
import { SurveyStepLink } from '../SurveyNavigation/SurveyStepLink';
import styles from './UnderfloorHeatingSummaryTable.module.css';

export type UnderfloorHeatingSummaryTableProps = {
  underfloorHeating: ParsedUnderfloorHeating | null;
  uniboxes?: ParsedUniboxesMatching | null;
  hydraulicsPumps?: readonly ParsedHydraulicsPumpProposal[] | null;
};

/**
 * @param props
 */
export function UnderfloorHeatingSummaryTable({
  underfloorHeating,
  uniboxes = null,
  hydraulicsPumps = null,
}: UnderfloorHeatingSummaryTableProps) {
  if (!hasUnderfloorHeatingReportContent(underfloorHeating) || underfloorHeating == null) {
    return null;
  }

  const selectedUniboxes =
    uniboxes?.byLoop.filter((row) => row.selected != null).length ?? 0;
  const uniboxLoops = uniboxes?.byLoop.length ?? 0;
  const uniboxLabel =
    uniboxes == null
      ? '—'
      : uniboxLoops === 0
        ? 'немає петель'
        : `${selectedUniboxes} / ${uniboxLoops}`;

  const ufhPumps = selectUfhZonePumps(hydraulicsPumps);
  const pumpLabel = ufhPumpSummaryLabel(
    underfloorHeating.isMixingNodeRequired,
    ufhPumps,
  );

  const hasWarnings =
    underfloorHeating.warnings.length > 0
    || underfloorHeating.resolvedRecommendations.length > 0
    || (uniboxes?.warnings.length ?? 0) > 0;

  return (
    <div
      id={RESULTS_SECTION_IDS.warmFloor}
      className={styles.wrap}
      aria-labelledby="underfloor-heating-summary-title"
    >
      <h3 id="underfloor-heating-summary-title" className={styles.title}>
        Тепла підлога (підсумок)
      </h3>
      {underfloorHeating.rooms.length === 0 ? (
        <p className={styles.hint}>
          Режим ТП увімкнено, але немає приміщень з ТП. Деталі — на кроці{' '}
          <SurveyStepLink step="warmFloor">«Тепла підлога»</SurveyStepLink>
          .
        </p>
      ) : (
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
                <td>Контур</td>
                <td>
                  {underfloorHeating.circuitSupplyC}/
                  {underfloorHeating.circuitReturnC} °C
                </td>
              </tr>
              <tr>
                <td>Σ q↑ (тепло вгору в приміщення)</td>
                <td>{formatKw(underfloorHeating.totalHeatFluxUpWatts / 1000, 2)} кВт</td>
              </tr>
              <tr>
                <td>Σ q↓ (тепло вниз, втрати в перекриття)</td>
                <td>
                  {formatKw(underfloorHeating.totalHeatFluxDownWatts / 1000, 2)} кВт
                </td>
              </tr>
              <tr>
                <td>Приміщень з ТП</td>
                <td>{underfloorHeating.rooms.length}</td>
              </tr>
              <tr>
                <td>Змішувальний вузол</td>
                <td>
                  {underfloorHeating.isMixingNodeRequired
                    ? 'потрібно'
                    : underfloorHeating.circuitSource === 'ufh_mode_preset'
                      ? 'не потрібно (пряме підключення, котел 40/30)'
                      : 'не потрібно'}
                </td>
              </tr>
              <tr>
                <td>Насос контуру ТП</td>
                <td>{pumpLabel}</td>
              </tr>
              <tr>
                <td>Унибокси (підібрано / петель)</td>
                <td>{uniboxLabel}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {underfloorHeating.rooms.length > 0 && (
        <p className={styles.hint}>
          Деталі розрахунку за приміщеннями, унибоксами та насосом контуру — на кроці{' '}
          <SurveyStepLink step="warmFloor">«Тепла підлога»</SurveyStepLink>
          .
        </p>
      )}
      {hasWarnings && (
        <p className={styles.attention}>
          Зверніть увагу на рекомендації та попередження в картці{' '}
          <SurveyStepLink step="warmFloor">«Тепла підлога»</SurveyStepLink>
          .
        </p>
      )}
    </div>
  );
}
