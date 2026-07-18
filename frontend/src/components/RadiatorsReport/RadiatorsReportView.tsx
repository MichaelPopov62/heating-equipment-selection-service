/**
 * Призначення: повний звіт підбору радіаторів.
 * Опис: Тіло модалки кроку «Радіатори»; деталізація не дублюється в «Рекомендації».
 */

import {
  formatRadiatorsEmittersSummaryLabel,
  type ParsedRadiatorsMatching,
} from '../../utils/parseRadiatorsMatchingFromReport';
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
        Подбор по matching.radiators. Таблицы рядом с котлом в блоке «Рекомендация»
        остаются для сравнения вариантов; здесь — полный расчёт.
      </p>

      {showInputs ? (
        <>
          <h4 className={styles.sectionTitle}>Исходные параметры</h4>
          <dl className={styles.dl}>
            {inputs.supplyC != null && inputs.returnC != null && (
              <>
                <dt>График подача / обратка</dt>
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
                <dt>Δt расхода</dt>
                <dd>{inputs.flowDeltaTK} K</dd>
              </>
            )}
            {inputs.radiatorConnection != null && (
              <>
                <dt>Подводка</dt>
                <dd>
                  {inputs.radiatorConnection === 'bottom' ? 'нижняя' : 'боковая'}
                  <span className={styles.muted}>
                    {' '}
                    ({inputs.radiatorConnection})
                  </span>
                </dd>
              </>
            )}
            {inputs.radiatorEmitterPreference != null && (
              <>
                <dt>Тип приборов (анкета)</dt>
                <dd>
                  {inputs.radiatorEmitterPreference === 'auto'
                    ? 'авто (Two-Pass)'
                    : inputs.radiatorEmitterPreference === 'panel'
                      ? 'панельные'
                      : 'секционные'}
                  <span className={styles.muted}>
                    {' '}
                    ({inputs.radiatorEmitterPreference})
                  </span>
                </dd>
              </>
            )}
            {radiators.resolvedEmitterKind != null && (
              <>
                <dt>Тип приборов (результат)</dt>
                <dd>
                  {radiators.resolvedEmitterKind === 'panel'
                    ? 'панельные'
                    : 'секционные'}
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
          <h4 className={styles.sectionTitle}>Агрегаты по объекту</h4>
          <dl className={styles.dl}>
            {radiators.chosenModel != null && radiators.chosenModel.length > 0 && (
              <>
                <dt>Модель (подбор)</dt>
                <dd>{radiators.chosenModel}</dd>
              </>
            )}
            {emittersLabel != null && (
              <>
                <dt>Приборы</dt>
                <dd>{emittersLabel}</dd>
              </>
            )}
            {radiators.totalSections != null && (
              <>
                <dt>Секции (без панелей)</dt>
                <dd>{radiators.totalSections} шт.</dd>
              </>
            )}
            {radiators.byRoom.length > 0 && (
              <>
                <dt>Комнат в подборе</dt>
                <dd>{radiators.byRoom.length}</dd>
              </>
            )}
          </dl>
        </>
      ) : null}

      {hasProposalLines && (
        <>
          <h4 className={styles.sectionTitle}>Линии эконом / эффективный</h4>
          <div className={styles.proposalLinesGrid}>
            <RadiatorProposalLineTable
              line={radiators.lineEconomy}
              caption="Вариант 1 · эконом"
              tableId="radiators-report-line-economy"
            />
            <RadiatorProposalLineTable
              line={radiators.lineEfficient}
              caption="Вариант 2 · эффективный"
              tableId="radiators-report-line-efficient"
            />
          </div>
        </>
      )}

      {radiators.warnings.length > 0 && (
        <>
          <h4 className={styles.sectionTitle}>Предупреждения</h4>
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
