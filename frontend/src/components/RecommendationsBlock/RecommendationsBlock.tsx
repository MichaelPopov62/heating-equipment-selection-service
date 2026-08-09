/**
 * Назначение: блок технического результата расчёта (шаг анкеты technicalResult).
 * Описание: теплопотери (таблица), ГВ, ТП, summary; в «Рекомендация» — котёл, радиаторы, трубы.
 * Справочник каталога — шаг анкеты «Справочник данных» (CatalogEquipmentReference).
 * Финансовый итог — шаг «Итог финансовый» (FinancialSummaryTable / report.commercial).
 */

import type { MouseEvent } from 'react';
import type { RecommendationsBlockProps } from '../../types/recommendationsBlock';
import { isSurveyStep } from '../../constants/surveySteps';
import { SCHEME_BOILER_MAX_COMBI } from '../../types/heatingMatching';
import { getBoilerUiLabels } from '../../utils/boilerUiLabels';
import { BoilerProposalCard } from '../BoilerProposalCard/BoilerProposalCard';
import { RadiatorProposalLineTable } from '../RadiatorProposalLineTable/RadiatorProposalLineTable';
import { UnderfloorHeatingSummaryTable } from '../UnderfloorHeatingReport/UnderfloorHeatingSummaryTable';
import { HotWaterFixturesSummaryTable } from '../HotWaterReport/HotWaterFixturesSummaryTable';
import { HotWaterSummaryTable } from '../HotWaterReport/HotWaterSummaryTable';
import { hasHotWaterSummaryContent } from '../HotWaterReport/hasHotWaterSummaryContent';
import { hasHotWaterFixturesContent } from '../../utils/countThermalFixtures';
import { hasRadiatorsReportContent } from '../RadiatorsReport/hasRadiatorsReportContent';
import { isRadiatorsMatchingSkipped } from '../../utils/radiatorsSkip';
import { RadiatorsSummaryTable } from '../RadiatorsReport/RadiatorsSummaryTable';
import { hasBoilerReportContent } from '../BoilerReport/hasBoilerReportContent';
import { BoilerSummaryTable } from '../BoilerReport/BoilerSummaryTable';
import { hasHydraulicsReportContent } from '../HydraulicsReport/hasHydraulicsReportContent';
import { HydraulicsSummaryTable } from '../HydraulicsReport/HydraulicsSummaryTable';
import { HydraulicsProposalTable } from '../HydraulicsReport/HydraulicsProposalTable';
import { HeatLossSummaryTable } from '../HeatLossReport/HeatLossSummaryTable';
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
  onApplyScheme,
  apiHydraulicsFromReport,
  calcLoading = false,
  reportIsStale = false,
  uiPhase = 'idle',
  onNavigateToSurveyStep,
}: RecommendationsBlockProps) {
  const showRecalculating = calcLoading || reportIsStale || uiPhase === 'recalculating';
  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <section
        aria-labelledby="calculation-results-title"
        onClick={(e) => { handleSummaryNavigateClick(e, onNavigateToSurveyStep); }}
      >
        <h2 id="calculation-results-title">Результати розрахунку</h2>

        {apiCatalogSource != null && (
          <p className={`${styles.hint} ${styles.hintMt8Mb0}`}>
            {apiCatalogSource === 'mongo'
              ? 'Підбір обладнання виконано за каталогом із бази даних (MongoDB).'
              : 'Підбір за файловим каталогом. Для використання БД: CATALOG_SOURCE=auto (або mongo), змінні MONGODB_* і колекція Product після seed.'}
          </p>
        )}

        {showRecalculating && (
          <p className={styles.hint} role="status" aria-live="polite">
            Оновлення розрахунку на сервері… Показано дані попередньої відповіді до завершення перерахунку.
          </p>
        )}

        {apiAutomationHints.length > 0 && (
          <div className={styles.boilerCalcSummary} role="status" aria-live="polite">
            <h3 className={styles.boilerCalcSummaryTitle}>
              Рекомендації щодо схеми котел / ГВП
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
                      Застосувати схему в анкеті
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Группа: Отопление */}
        <div className={styles.summaryGroup}>
          <HeatLossSummaryTable
            apiHeatLoss={apiHeatLoss}
            quickEstimate={quickEstimate}
          />
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
            && !isRadiatorsMatchingSkipped(apiRadiatorsFromReport)
            && (apiRadiatorsFromReport.lineEconomy != null
              || apiRadiatorsFromReport.lineEfficient != null) && (
            <div className={styles.radiatorsRecBlock}>
              <h4 className={styles.radiatorsRecTitle}>Радіатори · за варіантами</h4>
              <div className={styles.radiatorsProposalLinesGrid}>
                <RadiatorProposalLineTable
                  line={apiRadiatorsFromReport.lineEconomy}
                  caption="Варіант 1 · економ"
                  tableId="radiators-line-economy"
                />
                <RadiatorProposalLineTable
                  line={apiRadiatorsFromReport.lineEfficient}
                  caption="Варіант 2 · ефективний"
                  tableId="radiators-line-efficient"
                />
              </div>
            </div>
          )}

          {isRadiatorsMatchingSkipped(apiRadiatorsFromReport) && (
            <p className={styles.hint} role="status">
              Радіатори за варіантами не підбираються: режим «лише тепла підлога».
            </p>
          )}

          <HydraulicsProposalTable
            hydraulics={apiHydraulicsFromReport ?? null}
          />
        </div>
      </section>
    </div>
  );
}
