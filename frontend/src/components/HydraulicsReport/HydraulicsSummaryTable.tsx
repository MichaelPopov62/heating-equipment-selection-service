/**
 * Призначення: компактний підсумок гідравліки для сайдбара «Итог».
 * Опис: KPI; довжини — за призначенням ділянок (магістраль / колектор), не число SKU.
 */

import { RESULTS_SECTION_IDS } from '../../constants/surveyResultsSections';
import type { ParsedHydraulicsView } from '../../types/hydraulics';
import { formatBrandModel } from '../../utils/format';
import { sumHydraulicsPipeLengthsByRole } from '../../utils/sumHydraulicsPipeLengthsByRole';
import { excludeUfhZonePumps } from '../../utils/ufhHydraulicsPumps';
import { SurveyStepLink } from '../SurveyNavigation/SurveyStepLink';
import { hasHydraulicsReportContent } from './hasHydraulicsReportContent';
import styles from './HydraulicsSummaryTable.module.css';

export type HydraulicsSummaryTableProps = {
  hydraulics: ParsedHydraulicsView | null;
};

/**
 * @param props
 */
export function HydraulicsSummaryTable({
  hydraulics,
}: HydraulicsSummaryTableProps) {
  if (!hasHydraulicsReportContent(hydraulics) || hydraulics == null) {
    return null;
  }

  const proposal = hydraulics.proposal;
  const calculations = hydraulics.calculations;
  const flow =
    proposal != null && proposal.designFlowM3PerHour > 0
      ? proposal.designFlowM3PerHour
      : calculations?.flowRateM3PerHour ?? 0;
  const head =
    proposal != null && proposal.headRequiredM > 0
      ? proposal.headRequiredM
      : calculations?.headRequiredM ?? 0;

  const pumps = excludeUfhZonePumps(proposal?.pumps ?? []);
  const primaryPump = pumps[0] ?? proposal?.pump ?? null;
  const pumpLabel = (() => {
    if (primaryPump == null) return null;
    const base = formatBrandModel(primaryPump.brand, primaryPump.model);
    if (primaryPump.pumpSource === 'catalog') {
      return `${base} — дод. на котлову гілку (вбудований слабкий)`;
    }
    return base;
  })();

  const hasWarnings =
    hydraulics.matchingWarnings.length > 0
    || (proposal?.warnings.length ?? 0) > 0
    || (calculations?.notes.length ?? 0) > 0;

  const deltaT =
    calculations?.deltaTSystemK
    ?? hydraulics.flowContext?.flowDeltaTK
    ?? null;

  const lengthsFromSegments =
    proposal != null && proposal.pipeSegments.length > 0
      ? sumHydraulicsPipeLengthsByRole(proposal.pipeSegments)
      : null;

  const mainLineM =
    lengthsFromSegments != null && lengthsFromSegments.mainLineM > 0
      ? lengthsFromSegments.mainLineM
      : calculations?.mainLineLengthM != null && calculations.mainLineLengthM > 0
        ? Math.round(calculations.mainLineLengthM * 10) / 10
        : 0;

  const collectorBranchesM =
    lengthsFromSegments != null && lengthsFromSegments.collectorBranchesM > 0
      ? lengthsFromSegments.collectorBranchesM
      : 0;

  return (
    <div
      id={RESULTS_SECTION_IDS.hydraulics}
      className={styles.wrap}
      aria-labelledby="hydraulics-summary-title"
    >
      <h3 id="hydraulics-summary-title" className={styles.title}>
        Гідравліка (підсумок)
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
            {flow > 0 && (
              <tr>
                <td>Розрахункова витрата</td>
                <td>{flow.toFixed(3)} м³/ч</td>
              </tr>
            )}
            {head > 0 && (
              <tr>
                <td>Потрібний напір</td>
                <td>{head.toFixed(2)} м</td>
              </tr>
            )}
            {deltaT != null && (
              <tr>
                <td>Δt витрати</td>
                <td>{deltaT} K</td>
              </tr>
            )}
            {mainLineM > 0 && (
              <tr>
                <td>Магистраль</td>
                <td>{mainLineM.toFixed(1)} м</td>
              </tr>
            )}
            {collectorBranchesM > 0 && (
              <tr>
                <td>Коллектор</td>
                <td>{collectorBranchesM.toFixed(1)} м</td>
              </tr>
            )}
            {pumpLabel != null && (
              <tr>
                <td>Насос</td>
                <td>{pumpLabel}</td>
              </tr>
            )}
            {proposal != null && !proposal.hasPipeSelection && (
              <tr>
                <td>Труби</td>
                <td>
                  {proposal.unavailableReason
                    ?? 'Немає відповідних позицій у каталозі'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className={styles.hint}>
        Повний розрахунок, ціни та ділянки — на кроці{' '}
        <SurveyStepLink step="hydraulics">«Гідравліка»</SurveyStepLink>
        . Підбір труб без цін — у блоці «Рекомендація».
      </p>
      {hasWarnings && (
        <p className={styles.attention}>
          Є попередження щодо гідравліки — відкрийте звіт на кроці{' '}
          <SurveyStepLink step="hydraulics">«Гідравліка»</SurveyStepLink>
          .
        </p>
      )}
    </div>
  );
}
