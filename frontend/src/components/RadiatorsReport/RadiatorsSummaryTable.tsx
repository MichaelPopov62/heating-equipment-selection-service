/**
 * Призначення: компактний підсумок радіаторів для сайдбару «Итог».
 * Опис: Ключові цифри; деталі — у модалці кроку «Радіатори».
 */

import {
  formatRadiatorsEmittersSummaryLabel,
  type ParsedRadiatorsMatching,
} from '../../utils/parseRadiatorsMatchingFromReport';
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
          Радиаторы (итог)
        </h3>
        <p className={styles.hint}>
          Режим «только тёплый пол» — подбор радиаторов не выполняется. Секции
          приборов не требуются. Детали — на шаге{' '}
          <SurveyStepLink step="radiators">«Радиаторы»</SurveyStepLink>
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
      ? 'нижняя'
      : radiators.inputs?.radiatorConnection === 'side'
        ? 'боковая'
        : null;

  const kindLabel =
    radiators.resolvedEmitterKind === 'panel'
      ? 'панельные'
      : radiators.resolvedEmitterKind === 'sectional'
        ? 'секционные'
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
        Радиаторы (итог)
      </h3>
      {onlySkipWarnings ? (
        <p className={styles.hint}>
          Подбор радиаторов пропущен или ещё без комнат в отчёте. Детали — на шаге{' '}
          <SurveyStepLink step="radiators">«Радиаторы»</SurveyStepLink>
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
                <td>Приборы / секции</td>
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
                  <td>График</td>
                  <td>{graphLabel}</td>
                </tr>
              )}
              {connectionLabel != null && (
                <tr>
                  <td>Подводка</td>
                  <td>{connectionLabel}</td>
                </tr>
              )}
              {kindLabel != null && (
                <tr>
                  <td>Тип приборов</td>
                  <td>{kindLabel}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.hint}>
        Полный расчёт и предупреждения — на шаге{' '}
        <SurveyStepLink step="radiators">«Радиаторы»</SurveyStepLink>
        . Таблицы по вариантам рядом с котлом — в блоке «Рекомендация».
      </p>
      {hasWarnings && (
        <p className={styles.attention}>
          Есть предупреждения по радиаторам — откройте отчёт на шаге{' '}
          <SurveyStepLink step="radiators">«Радиаторы»</SurveyStepLink>
          .
        </p>
      )}
    </div>
  );
}
