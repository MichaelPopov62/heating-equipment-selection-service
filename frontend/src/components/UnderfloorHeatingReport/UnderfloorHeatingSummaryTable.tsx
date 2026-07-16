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
        ? 'нет петель'
        : `${selectedUniboxes} / ${uniboxLoops}`;

  const ufhPumps = selectUfhZonePumps(hydraulicsPumps);
  const pumpLabel = ufhPumpSummaryLabel(
    underfloorHeating.isMixingNodeRequired,
    ufhPumps,
  );

  const hasWarnings =
    underfloorHeating.warnings.length > 0
    || (uniboxes?.warnings.length ?? 0) > 0;

  return (
    <div
      id={RESULTS_SECTION_IDS.warmFloor}
      className={styles.wrap}
      aria-labelledby="underfloor-heating-summary-title"
    >
      <h3 id="underfloor-heating-summary-title" className={styles.title}>
        Тёплый пол (итог)
      </h3>
      {underfloorHeating.rooms.length === 0 ? (
        <p className={styles.hint}>
          Режим ТП включён, но нет комнат с ТП. Детали — на шаге{' '}
          <SurveyStepLink step="warmFloor">«Тёплый пол»</SurveyStepLink>
          .
        </p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Показатель</th>
                <th>Значение</th>
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
                <td>Σ q↑ (тепло вверх в помещение)</td>
                <td>{formatKw(underfloorHeating.totalHeatFluxUpWatts / 1000, 2)} кВт</td>
              </tr>
              <tr>
                <td>Σ q↓ (тепло вниз, потери в перекрытие)</td>
                <td>
                  {formatKw(underfloorHeating.totalHeatFluxDownWatts / 1000, 2)} кВт
                </td>
              </tr>
              <tr>
                <td>Комнат с ТП</td>
                <td>{underfloorHeating.rooms.length}</td>
              </tr>
              <tr>
                <td>Смесительный узел</td>
                <td>{underfloorHeating.isMixingNodeRequired ? 'требуется' : 'не требуется'}</td>
              </tr>
              <tr>
                <td>Насос контура ТП</td>
                <td>{pumpLabel}</td>
              </tr>
              <tr>
                <td>Унибоксы (подобрано / петель)</td>
                <td>{uniboxLabel}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {underfloorHeating.rooms.length > 0 && (
        <p className={styles.hint}>
          Детали расчёта по комнатам, унибоксам и насосу контура — на шаге{' '}
          <SurveyStepLink step="warmFloor">«Тёплый пол»</SurveyStepLink>
          .
        </p>
      )}
      {hasWarnings && (
        <p className={styles.attention}>
          Обратите внимание на рекомендации и предупреждения в карте{' '}
          <SurveyStepLink step="warmFloor">«Тёплый пол»</SurveyStepLink>
          .
        </p>
      )}
    </div>
  );
}
