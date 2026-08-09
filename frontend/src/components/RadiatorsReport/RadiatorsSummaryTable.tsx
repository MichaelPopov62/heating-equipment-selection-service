/**
 * Призначення: компактний підсумок радіаторів для сайдбару «Итог».
 * Опис: Ключові цифри; деталі — у модалці кроку «Радіатори».
 */

import {
  formatRadiatorsEmittersSummaryLabel,
  type ParsedRadiatorsMatching,
} from '../../utils/parsers/parseRadiatorsMatchingFromReport';
import { isRadiatorsMatchingSkipped } from '../../utils/radiatorsSkip';
import { RESULTS_SECTION_IDS } from '../../constants/surveyResultsSections';
import { SurveyStepLink } from '../SurveyNavigation/SurveyStepLink';
import { hasRadiatorsReportContent } from './hasRadiatorsReportContent';
import styles from './RadiatorsSummaryTable.module.css';

export type RadiatorsSummaryTableProps = {
  radiators: ParsedRadiatorsMatching | null;
  /** Підпис агрегату секцій / приладів (з useCalcReport або чернетка). */
  sectionsTotalLabel: string;
};

/**
 * @param props
 */
export function RadiatorsSummaryTable({
  radiators,
  sectionsTotalLabel,
}: RadiatorsSummaryTableProps) {
  if (!hasRadiatorsReportContent(radiators) || radiators == null) {
    return null;
  }

  if (isRadiatorsMatchingSkipped(radiators)) {
    return (
      <div
        id={RESULTS_SECTION_IDS.radiators}
        className={styles.wrap}
        aria-labelledby="radiators-summary-title"
      >
        <h3 id="radiators-summary-title" className={styles.title}>
          Радіатори (підсумок)
        </h3>
        <p className={styles.hint}>
          Режим «лише тепла підлога» — підбір радіаторів не виконується. Секції
          приладів не потрібні. Деталі — на кроці{' '}
          <SurveyStepLink step="radiators">«Радіатори»</SurveyStepLink>
          .
        </p>
      </div>
    );
  }

  const emittersLabel = formatRadiatorsEmittersSummaryLabel(radiators.emittersSummary);
  const instrumentsLabel = emittersLabel ?? sectionsTotalLabel;
  const hasWarnings = radiators.warnings.length > 0;

  const graphLabel =
    radiators.inputs?.supplyC != null && radiators.inputs.returnC != null
      ? `${radiators.inputs.supplyC}/${radiators.inputs.returnC} °C`
      : null;

  const connectionLabel =
    radiators.inputs?.radiatorConnection === 'bottom'
      ? 'нижня'
      : radiators.inputs?.radiatorConnection === 'side'
        ? 'бокова'
        : null;

  const kindLabel =
    radiators.resolvedEmitterKind === 'panel'
      ? 'панельні'
      : radiators.resolvedEmitterKind === 'sectional'
        ? 'секційні'
        : null;

  const onlySkipWarnings =
    radiators.byRoom.length === 0
    && radiators.emittersSummary == null
    && radiators.totalSections == null
    && radiators.chosenModel == null
    && hasWarnings;

  return (
    <div
      id={RESULTS_SECTION_IDS.radiators}
      className={styles.wrap}
      aria-labelledby="radiators-summary-title"
    >
      <h3 id="radiators-summary-title" className={styles.title}>
        Радіатори (підсумок)
      </h3>
      {onlySkipWarnings ? (
        <p className={styles.hint}>
          Підбір радіаторів пропущено або ще без приміщень у звіті. Деталі — на кроці{' '}
          <SurveyStepLink step="radiators">«Радіатори»</SurveyStepLink>
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
                <td>Прилади / секції</td>
                <td>{instrumentsLabel}</td>
              </tr>
              {radiators.chosenModel != null && radiators.chosenModel.length > 0 && (
                <tr>
                  <td>Модель</td>
                  <td>{radiators.chosenModel}</td>
                </tr>
              )}
              {graphLabel != null && (
                <tr>
                  <td>Графік</td>
                  <td>{graphLabel}</td>
                </tr>
              )}
              {connectionLabel != null && (
                <tr>
                  <td>Підводка</td>
                  <td>{connectionLabel}</td>
                </tr>
              )}
              {kindLabel != null && (
                <tr>
                  <td>Тип приладів</td>
                  <td>{kindLabel}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.hint}>
        Повний розрахунок і попередження — на кроці{' '}
        <SurveyStepLink step="radiators">«Радіатори»</SurveyStepLink>
        . Таблиці за варіантами поруч із котлом — у блоці «Рекомендація».
      </p>
      {hasWarnings && (
        <p className={styles.attention}>
          Є попередження щодо радіаторів — відкрийте звіт на кроці{' '}
          <SurveyStepLink step="radiators">«Радіатори»</SurveyStepLink>
          .
        </p>
      )}
    </div>
  );
}
