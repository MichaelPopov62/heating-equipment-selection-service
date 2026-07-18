/**
 * Призначення: повний звіт підбору котла.
 * Опис: Тіло модалки кроку «Котёл»; деталізація не дублюється в «Рекомендації».
 */

import type { ObjectType } from '../../types/envelope';
import { getBoilerUiLabels } from '../../utils/boilerUiLabels';
import { formatCoefficient, formatKw } from '../../utils/format';
import type { ParsedBoilerMatching } from '../../utils/parsers/parseBoilerFromReport';
import { BoilerProposalCard } from '../BoilerProposalCard/BoilerProposalCard';
import styles from './BoilerReportView.module.css';

export type BoilerReportViewProps = {
  boiler: ParsedBoilerMatching;
  objectType: ObjectType;
  catalogSource?: 'file' | 'mongo' | null;
};

/**
 * @param props
 */
export function BoilerReportView({
  boiler,
  objectType,
  catalogSource = null,
}: BoilerReportViewProps) {
  const summary = boiler.summary;
  const labels =
    summary != null
      ? getBoilerUiLabels(summary.hotWaterBoilerPowerMatchingScheme, objectType)
      : null;

  const hasTiers = boiler.tierEconomy != null || boiler.tierEfficient != null;
  const showLegacy =
    !hasTiers && boiler.legacyProposal != null;

  return (
    <div>
      <p className={styles.hint}>
        Подбор по matching.boiler. В блоке «Рекомендация» — компактная таблица
        вариантов котла; здесь — полный расчёт и карточки подбора.
      </p>

      {summary != null && labels != null && (
        <>
          <h4 className={styles.sectionTitle}>{labels.summaryHeadline}</h4>
          <dl className={styles.dl}>
            <dt>Теплопотери здания</dt>
            <dd>
              {formatKw(summary.heatLossKw)} <span>кВт</span>
            </dd>
            <dt>
              Запас на отопление (×{formatCoefficient(summary.reserveFactor)})
            </dt>
            <dd>
              {formatKw(summary.heatingLoadKw)} <span>кВт</span>
            </dd>
            <dt>{labels.dhwPartLabel}</dt>
            <dd>
              {formatKw(summary.hotWaterPowerKw)} <span>кВт</span>
            </dd>
            <dt className={styles.totalLabel}>{labels.requiredKwLabel}</dt>
            <dd className={styles.totalValue}>
              {formatKw(summary.requiredKw)} <span>кВт</span>
            </dd>
            {summary.condensingHeatingReserveFactor != null
              && summary.heatingLoadKwCondensing != null
              && summary.requiredKwForCondensingLine != null && (
              <>
                <dt>
                  Запас на отопление для линии «Эффективный» (×
                  {formatCoefficient(summary.condensingHeatingReserveFactor)})
                </dt>
                <dd>
                  {formatKw(summary.heatingLoadKwCondensing)} <span>кВт</span>
                </dd>
                <dt className={styles.totalLabel}>
                  {labels.condensingRequiredLabel}
                </dt>
                <dd className={styles.totalValue}>
                  {formatKw(summary.requiredKwForCondensingLine)}{' '}
                  <span>кВт</span>
                </dd>
              </>
            )}
          </dl>
        </>
      )}

      {boiler.warnings.length > 0 && (
        <>
          <h4 className={styles.sectionTitle}>Предупреждения</h4>
          <ul className={styles.warningsList}>
            {boiler.warnings.map((w, i) => (
              <li key={`boiler-report-w-${i}-${w.slice(0, 64)}`}>{w}</li>
            ))}
          </ul>
        </>
      )}

      {hasTiers && (
        <>
          <h4 className={styles.sectionTitle}>Варианты подбора</h4>
          <p className={styles.hint}>
            Два варианта под один и тот же расчёт — сравнение по бюджету и режимам
            ГВС.
          </p>
          <div className={styles.cardsRow}>
            {boiler.tierEconomy != null && (
              <div className={styles.cardCol}>
                <BoilerProposalCard
                  proposal={boiler.tierEconomy}
                  catalogSource={catalogSource}
                  sectionTitle={
                    labels?.proposalEconomyTitle
                    ?? 'Вариант 1 · эконом класс'
                  }
                  titleDomId="boiler-report-proposal-economy"
                />
              </div>
            )}
            {boiler.tierEfficient != null && (
              <div className={styles.cardCol}>
                <BoilerProposalCard
                  proposal={boiler.tierEfficient}
                  catalogSource={catalogSource}
                  sectionTitle={
                    labels?.proposalEfficientTitle
                    ?? 'Вариант 2 · эффективный / конденсационный'
                  }
                  titleDomId="boiler-report-proposal-efficient"
                />
              </div>
            )}
          </div>
        </>
      )}

      {showLegacy && boiler.legacyProposal != null && (
        <>
          <h4 className={styles.sectionTitle}>Подбор котла</h4>
          <BoilerProposalCard
            proposal={boiler.legacyProposal}
            catalogSource={catalogSource}
            titleDomId="boiler-report-proposal-legacy"
          />
        </>
      )}
    </div>
  );
}
