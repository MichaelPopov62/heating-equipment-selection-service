/**
 * Призначення: компактний підсумок котла для сайдбара «Итог».
 * Опис: KPI; деталі — у модалці кроку «Котёл». Існуючі summary інших модулів не змінює.
 */

import type { ObjectType } from '../../types/envelope';
import { RESULTS_SECTION_IDS } from '../../constants/surveyResultsSections';
import { getBoilerUiLabels } from '../../utils/boilerUiLabels';
import { formatKw } from '../../utils/format';
import type { ParsedBoilerMatching } from '../../utils/parsers/parseBoilerFromReport';
import { SurveyStepLink } from '../SurveyNavigation/SurveyStepLink';
import { hasBoilerReportContent } from './hasBoilerReportContent';
import { formatBoilerProposalShortLabel } from './formatBoilerProposalShortLabel';
import styles from './BoilerSummaryTable.module.css';

export type BoilerSummaryTableProps = {
  boiler: ParsedBoilerMatching | null;
  objectType: ObjectType;
  /** Fallback requiredKw до відповіді API (quickEstimate). */
  requiredKwFallback: number | null;
};

/**
 * @param props
 */
export function BoilerSummaryTable({
  boiler,
  objectType,
  requiredKwFallback,
}: BoilerSummaryTableProps) {
  if (!hasBoilerReportContent(boiler) || boiler == null) {
    return null;
  }

  const summary = boiler.summary;
  const labels =
    summary != null
      ? getBoilerUiLabels(summary.hotWaterBoilerPowerMatchingScheme, objectType)
      : null;
  const requiredKw = summary?.requiredKw ?? requiredKwFallback;
  const hasWarnings = boiler.warnings.length > 0;
  const economyLabel = formatBoilerProposalShortLabel(boiler.tierEconomy);
  const efficientLabel = formatBoilerProposalShortLabel(boiler.tierEfficient);
  const legacyLabel =
    boiler.tierEconomy == null && boiler.tierEfficient == null
      ? formatBoilerProposalShortLabel(boiler.legacyProposal)
      : null;

  return (
    <div
      id={RESULTS_SECTION_IDS.boiler}
      className={styles.wrap}
      aria-labelledby="boiler-summary-title"
    >
      <h3 id="boiler-summary-title" className={styles.title}>
        Котел (підсумок)
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
            {requiredKw != null && (
              <tr>
                <td>Потрібна потужність</td>
                <td>{formatKw(requiredKw)} кВт</td>
              </tr>
            )}
            {summary?.requiredKwForCondensingLine != null && (
              <tr>
                <td>
                  {labels?.condensingRequiredLabel
                    ?? 'Лінія конденсації'}
                </td>
                <td>{formatKw(summary.requiredKwForCondensingLine)} кВт</td>
              </tr>
            )}
            {economyLabel != null && (
              <tr>
                <td>Варіант 1 · економ</td>
                <td>{economyLabel}</td>
              </tr>
            )}
            {efficientLabel != null && (
              <tr>
                <td>Варіант 2 · ефективний</td>
                <td>{efficientLabel}</td>
              </tr>
            )}
            {legacyLabel != null && (
              <tr>
                <td>Підбір</td>
                <td>{legacyLabel}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className={styles.hint}>
        Повний розрахунок і картки підбору — на кроці{' '}
        <SurveyStepLink step="boiler">«Котел»</SurveyStepLink>
        . Порівняння варіантів у блоці «Рекомендація».
      </p>
      {hasWarnings && (
        <p className={styles.attention}>
          Є попередження щодо котла — відкрийте звіт на кроці{' '}
          <SurveyStepLink step="boiler">«Котел»</SurveyStepLink>
          .
        </p>
      )}
    </div>
  );
}
