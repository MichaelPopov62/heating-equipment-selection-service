/**
 * Назначение: боковая панель рекомендаций по расчёту.
 * Описание: теплопотери, ГВ, ТП, summary; в «Рекомендация» — котёл, радиаторы, трубы.
 */

import type { MouseEvent } from 'react';
import type { RecommendationsBlockProps } from '../../types/recommendationsBlock';
import { isSurveyStep } from '../../constants/surveySteps';
import { SCHEME_BOILER_MAX_COMBI } from '../../types/heatingMatching';
import { getBoilerUiLabels } from '../../utils/boilerUiLabels';
import {
  formatAreaM2,
  formatKw,
} from '../../utils/format';
import { BoilerProposalCard } from '../BoilerProposalCard/BoilerProposalCard';
import { RadiatorProposalLineTable } from '../RadiatorProposalLineTable/RadiatorProposalLineTable';
import { CatalogEquipmentReference } from '../CatalogEquipmentReference/CatalogEquipmentReference';
import { UnderfloorHeatingSummaryTable } from '../UnderfloorHeatingReport/UnderfloorHeatingSummaryTable';
import { HotWaterFixturesSummaryTable } from '../HotWaterReport/HotWaterFixturesSummaryTable';
import { HotWaterSummaryTable } from '../HotWaterReport/HotWaterSummaryTable';
import { hasHotWaterSummaryContent } from '../HotWaterReport/hasHotWaterSummaryContent';
import { hasHotWaterFixturesContent } from '../../utils/countThermalFixtures';
import { hasRadiatorsReportContent } from '../RadiatorsReport/hasRadiatorsReportContent';
import { RadiatorsSummaryTable } from '../RadiatorsReport/RadiatorsSummaryTable';
import { hasBoilerReportContent } from '../BoilerReport/hasBoilerReportContent';
import { BoilerSummaryTable } from '../BoilerReport/BoilerSummaryTable';
import { hasHydraulicsReportContent } from '../HydraulicsReport/hasHydraulicsReportContent';
import { HydraulicsSummaryTable } from '../HydraulicsReport/HydraulicsSummaryTable';
import { HydraulicsProposalTable } from '../HydraulicsReport/HydraulicsProposalTable';
import styles from './RecommendationsBlock.module.css';

/**
 * Делегирование клика по data-survey-step в дочерних summary-блоках.
 *
 * @param e
 * @param onNavigate
 */
function handleSummaryNavigateClick(
  e: MouseEvent<HTMLElement>,
  onNavigate: RecommendationsBlockProps['onNavigateToSurveyStep'],
) {
  if (onNavigate == null) return;
  const el = (e.target as HTMLElement).closest('[data-survey-step]');
  if (el == null) return;
  const step = el.getAttribute('data-survey-step');
  if (isSurveyStep(step)) {
    e.preventDefault();
    onNavigate(step);
  }
}

export function RecommendationsBlock({
  className,
  quickEstimate,
  apiHeatLoss,
  apiHotWaterFromReport,
  hotWaterFixtures,
  waterHeaterScheme,
  apiBoilerFromReport,
  apiBoilerKw,
  apiRadiatorsFromReport,
  apiIndirectWhFromReport,
  apiElectricWhFromReport,
  apiUnderfloorHeatingFromReport,
  apiUniboxesFromReport = null,
  displayedRadiatorSectionsTotal,
  apiCatalogSource,
  apiAutomationHints,
  objectType,
  catalogSnap,
  catalogSnapLoading,
  catalogSnapError,
  onRetryLoadCatalog,
  onApplyScheme,
  apiHydraulicsFromReport,
  calcLoading = false,
  reportIsStale = false,
  uiPhase = 'idle',
  onNavigateToSurveyStep,
}: RecommendationsBlockProps) {
  const showRecalculating = calcLoading || reportIsStale || uiPhase === 'recalculating';
  return (
    <aside className={[styles.root, className].filter(Boolean).join(' ')}>
      <section
        aria-labelledby="calculation-results-title"
        onClick={(e) => { handleSummaryNavigateClick(e, onNavigateToSurveyStep); }}
      >
        <h2 id="calculation-results-title">Результаты расчета</h2>

        {apiCatalogSource != null && (
          <p className={styles.hint} style={{ marginTop: 8, marginBottom: 0 }}>
            {apiCatalogSource === 'mongo'
              ? 'Подбор оборудования выполнен по каталогу из базы данных (MongoDB).'
              : 'Подбор по файловому каталогу. Для использования БД: CATALOG_SOURCE=auto (или mongo), переменные MONGODB_* и коллекция Product после seed.'}
          </p>
        )}

        {showRecalculating && (
          <p className={styles.hint} role="status" aria-live="polite">
            Обновление расчёта на сервере… Показаны данные предыдущего ответа до завершения пересчёта.
          </p>
        )}

        {apiAutomationHints.length > 0 && (
          <div className={styles.boilerCalcSummary} role="status" aria-live="polite">
            <h3 className={styles.boilerCalcSummaryTitle}>
              Рекомендации по схеме котёл / ГВС
            </h3>
            <ul className={styles.automationHintsList}>
              {apiAutomationHints.map((h, i) => (
                <li key={`${h.type}-${i}`}>
                  {h.message}
                  {h.suggestedScheme != null && (
                    <button
                      type="button"
                      className={styles.automationApplyBtn}
                      onClick={() => {
                        if (h.suggestedScheme != null) onApplyScheme(h.suggestedScheme);
                      }}
                    >
                      Применить схему в анкете
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Группа: Отопление */}
        <div className={styles.summaryGroup} aria-labelledby="heating-loss-title">
          <h3 id="heating-loss-title">Теплопотери</h3>
          <div className={styles.hint} style={{ marginBottom: 8 }}>
            {apiHeatLoss
              ? 'Источник: расчёт API по ограждениям'
              : 'Источник: быстрая оценка (100 Вт/м²)'}
          </div>
          <dl>
            <dt>Общая площадь помещений</dt>
            <dd>{formatAreaM2(quickEstimate.totalAreaM2)} <span>м²</span></dd>

            <dt>Мощность помещений</dt>
            <dd>
              {formatKw(apiHeatLoss?.heatLossKw ?? quickEstimate.heatLossKw, 1)}{' '}
              <span>кВт</span>
            </dd>

            <dt>Запас (15%)</dt>
            <dd>
              {formatKw(apiHeatLoss?.reserveKw ?? quickEstimate.reserveKw, 1)}{' '}
              <span>кВт</span>
            </dd>

            <dt className={styles.totalLabel}>Итого по теплу</dt>
            <dd className={styles.totalValue}>
              {formatKw(apiHeatLoss?.totalHeatKw ?? quickEstimate.totalHeatKw, 1)}{' '}
              <span>кВт</span>
            </dd>
          </dl>
        </div>

        {hasHotWaterFixturesContent(hotWaterFixtures) && (
          <div className={styles.summaryGroup}>
            <HotWaterFixturesSummaryTable fixtures={hotWaterFixtures} />
          </div>
        )}

        {apiUnderfloorHeatingFromReport != null && (
          <div className={styles.summaryGroup}>
            <UnderfloorHeatingSummaryTable
              underfloorHeating={apiUnderfloorHeatingFromReport}
              uniboxes={apiUniboxesFromReport}
              hydraulicsPumps={apiHydraulicsFromReport?.proposal?.pumps ?? null}
            />
          </div>
        )}

        {hasBoilerReportContent(apiBoilerFromReport) && (
          <div className={styles.summaryGroup}>
            <BoilerSummaryTable
              boiler={apiBoilerFromReport}
              objectType={objectType}
              requiredKwFallback={apiBoilerKw ?? quickEstimate.boilerKw}
            />
          </div>
        )}

        {hasRadiatorsReportContent(apiRadiatorsFromReport) && (
          <div className={styles.summaryGroup}>
            <RadiatorsSummaryTable
              radiators={apiRadiatorsFromReport}
              sectionsTotalLabel={displayedRadiatorSectionsTotal}
            />
          </div>
        )}

        {hasHydraulicsReportContent(apiHydraulicsFromReport) && (
          <div className={styles.summaryGroup}>
            <HydraulicsSummaryTable
              hydraulics={apiHydraulicsFromReport ?? null}
            />
          </div>
        )}

        {hasHotWaterSummaryContent(
          apiHotWaterFromReport,
          apiElectricWhFromReport,
          apiIndirectWhFromReport,
        ) && (
          <div className={styles.summaryGroup}>
            <HotWaterSummaryTable
              scheme={waterHeaterScheme}
              hotWater={apiHotWaterFromReport}
              electric={apiElectricWhFromReport}
              indirect={apiIndirectWhFromReport}
              calcLoading={showRecalculating}
            />
          </div>
        )}

        {/* Группа: Оборудование */}
        <div className={styles.summaryGroup}>
          {apiBoilerFromReport != null
            && (apiBoilerFromReport.tierEconomy != null
              || apiBoilerFromReport.tierEfficient != null) && (
            <div className={styles.boilerChoiceRow}>
              {apiBoilerFromReport.tierEconomy != null && (
                <div className={styles.boilerChoiceColumn}>
                  <BoilerProposalCard
                    proposal={apiBoilerFromReport.tierEconomy}
                    catalogSource={apiCatalogSource}
                    sectionTitle={getBoilerUiLabels(
                      apiBoilerFromReport.summary?.hotWaterBoilerPowerMatchingScheme
                        ?? SCHEME_BOILER_MAX_COMBI,
                      objectType,
                    ).proposalEconomyTitle}
                    titleDomId="boiler-proposal-economy"
                  />
                </div>
              )}
              {apiBoilerFromReport.tierEfficient != null && (
                <div className={styles.boilerChoiceColumn}>
                  <BoilerProposalCard
                    proposal={apiBoilerFromReport.tierEfficient}
                    catalogSource={apiCatalogSource}
                    sectionTitle={getBoilerUiLabels(
                      apiBoilerFromReport.summary?.hotWaterBoilerPowerMatchingScheme
                        ?? SCHEME_BOILER_MAX_COMBI,
                      objectType,
                    ).proposalEfficientTitle}
                    titleDomId="boiler-proposal-efficient"
                  />
                </div>
              )}
            </div>
          )}

          {apiBoilerFromReport != null
            && apiBoilerFromReport.tierEconomy == null
            && apiBoilerFromReport.tierEfficient == null
            && apiBoilerFromReport.legacyProposal != null && (
            <BoilerProposalCard
              proposal={apiBoilerFromReport.legacyProposal}
              catalogSource={apiCatalogSource}
            />
          )}

          {apiRadiatorsFromReport != null
            && (apiRadiatorsFromReport.lineEconomy != null
              || apiRadiatorsFromReport.lineEfficient != null) && (
            <div className={styles.radiatorsRecBlock}>
              <h4 className={styles.radiatorsRecTitle}>Радиаторы · по вариантам</h4>
              <div className={styles.radiatorsProposalLinesGrid}>
                <RadiatorProposalLineTable
                  line={apiRadiatorsFromReport.lineEconomy}
                  caption="Вариант 1 · эконом"
                  tableId="radiators-line-economy"
                />
                <RadiatorProposalLineTable
                  line={apiRadiatorsFromReport.lineEfficient}
                  caption="Вариант 2 · эффективный"
                  tableId="radiators-line-efficient"
                />
              </div>
            </div>
          )}

          <HydraulicsProposalTable
            hydraulics={apiHydraulicsFromReport ?? null}
          />
        </div>

        <CatalogEquipmentReference
          snapshot={catalogSnap}
          loading={catalogSnapLoading}
          error={catalogSnapError}
          onRetry={onRetryLoadCatalog}
        />
      </section>
    </aside>
  );
}
