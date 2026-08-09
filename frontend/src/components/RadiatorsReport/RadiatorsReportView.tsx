/**
 * Призначення: повний звіт підбору радіаторів.
 * Опис: Тіло модалки кроку «Радіатори»; деталізація не дублюється в «Рекомендації».
 */

import {
  formatRadiatorsEmittersSummaryLabel,
  type ParsedRadiatorsMatching,
} from '../../utils/parsers/parseRadiatorsMatchingFromReport';
import { RadiatorProposalLineTable } from '../RadiatorProposalLineTable/RadiatorProposalLineTable';
import styles from './RadiatorsReportView.module.css';

export type RadiatorsReportViewProps = {
  radiators: ParsedRadiatorsMatching;
};

/**
 * @param props
 */
export function RadiatorsReportView({ radiators }: RadiatorsReportViewProps) {
  const emittersLabel = formatRadiatorsEmittersSummaryLabel(radiators.emittersSummary);
  const inputs = radiators.inputs;
  const showInputs =
    inputs != null
    && (inputs.supplyC != null
      || inputs.flowDeltaTK != null
      || inputs.radiatorConnection != null
      || inputs.radiatorEmitterPreference != null
      || inputs.targetDeltaT != null);

  const hasProposalLines =
    radiators.lineEconomy != null || radiators.lineEfficient != null;

  return (
    <div>
      <p className={styles.hint}>
        Підбір за matching.radiators. Таблиці поруч із котлом у блоці «Рекомендація»
        залишаються для порівняння варіантів; тут — повний розрахунок.
      </p>

      {showInputs ? (
        <>
          <h4 className={styles.sectionTitle}>Вихідні параметри</h4>
          <dl className={styles.dl}>
            {inputs.supplyC != null && inputs.returnC != null && (
              <>
                <dt>Графік подача / зворотка</dt>
                <dd>
                  {inputs.supplyC}/{inputs.returnC} °C
                </dd>
              </>
            )}
            {inputs.targetDeltaT != null && (
              <>
                <dt>ΔT_mean (EN442)</dt>
                <dd>{inputs.targetDeltaT} K</dd>
              </>
            )}
            {inputs.flowDeltaTK != null && (
              <>
                <dt>Δt витрати</dt>
                <dd>{inputs.flowDeltaTK} K</dd>
              </>
            )}
            {inputs.radiatorConnection != null && (
              <>
                <dt>Підводка</dt>
                <dd>
                  {inputs.radiatorConnection === 'bottom' ? 'нижня' : 'бокова'}
                  <span className={styles.muted}>
                    {' '}
                    ({inputs.radiatorConnection})
                  </span>
                </dd>
              </>
            )}
            {inputs.radiatorEmitterPreference != null && (
              <>
                <dt>Тип приладів (анкета)</dt>
                <dd>
                  {inputs.radiatorEmitterPreference === 'auto'
                    ? 'авто (Two-Pass)'
                    : inputs.radiatorEmitterPreference === 'panel'
                      ? 'панельні'
                      : 'секційні'}
                  <span className={styles.muted}>
                    {' '}
                    ({inputs.radiatorEmitterPreference})
                  </span>
                </dd>
              </>
            )}
            {radiators.resolvedEmitterKind != null && (
              <>
                <dt>Тип приладів (результат)</dt>
                <dd>
                  {radiators.resolvedEmitterKind === 'panel'
                    ? 'панельні'
                    : 'секційні'}
                </dd>
              </>
            )}
          </dl>
        </>
      ) : null}

      {(radiators.chosenModel != null && radiators.chosenModel.length > 0)
        || emittersLabel != null
        || radiators.totalSections != null
        || radiators.byRoom.length > 0 ? (
        <>
          <h4 className={styles.sectionTitle}>Агрегати за об&apos;єктом</h4>
          <dl className={styles.dl}>
            {radiators.chosenModel != null && radiators.chosenModel.length > 0 && (
              <>
                <dt>Модель (підбір)</dt>
                <dd>{radiators.chosenModel}</dd>
              </>
            )}
            {emittersLabel != null && (
              <>
                <dt>Прилади</dt>
                <dd>{emittersLabel}</dd>
              </>
            )}
            {radiators.totalSections != null && (
              <>
                <dt>Секції (без панелей)</dt>
                <dd>{radiators.totalSections} шт.</dd>
              </>
            )}
            {radiators.byRoom.length > 0 && (
              <>
                <dt>Приміщень у підборі</dt>
                <dd>{radiators.byRoom.length}</dd>
              </>
            )}
          </dl>
        </>
      ) : null}

      {hasProposalLines && (
        <>
          <h4 className={styles.sectionTitle}>Лінії економ / ефективний</h4>
          <div className={styles.proposalLinesGrid}>
            <RadiatorProposalLineTable
              line={radiators.lineEconomy}
              caption="Варіант 1 · економ"
              tableId="radiators-report-line-economy"
            />
            <RadiatorProposalLineTable
              line={radiators.lineEfficient}
              caption="Варіант 2 · ефективний"
              tableId="radiators-report-line-efficient"
            />
          </div>
        </>
      )}

      {radiators.warnings.length > 0 && (
        <>
          <h4 className={styles.sectionTitle}>Попередження</h4>
          <ul className={styles.warningsList}>
            {radiators.warnings.map((w, i) => (
              <li key={`rad-report-w-${i}-${w.slice(0, 64)}`}>{w}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
