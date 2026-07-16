/**
 * Назначение: Боковая панель рекомендаций по расчёту.
 * Описание: Теплопотери, точки ГВ, котёл, радиаторы, бойлеры и предупреждения из JSON-отчёта.
 */

import type { MouseEvent } from 'react';
import type { RecommendationsBlockProps } from '../../types/recommendationsBlock';
import { isSurveyStep } from '../../constants/surveySteps';
import { SCHEME_BOILER_MAX_COMBI } from '../../types/heatingMatching';
import { getBoilerUiLabels } from '../../utils/boilerUiLabels';
import {
  formatAreaM2,
  formatCoefficient,
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
import { HydraulicsProposalSection } from '../HydraulicsProposal/HydraulicsProposalSection';
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

        <div className={styles.summaryGroup} aria-labelledby="hydraulics-proposal-title">
          <HydraulicsProposalSection
            hydraulics={apiHydraulicsFromReport ?? null}
            catalogSource={apiCatalogSource}
            calcLoading={showRecalculating}
            reportIsStale={showRecalculating}
          />
        </div>

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
        <div className={styles.summaryGroup} aria-labelledby="recommendation-title">
          <h3 id="recommendation-title">Рекомендация</h3>
          {apiCatalogSource != null && (
            <div className={styles.hint} style={{ marginBottom: 8 }}>
              {apiCatalogSource === 'mongo'
                ? 'Подбор оборудования выполнен по каталогу из базы данных (MongoDB).'
                : 'Подбор по файловому каталогу. Для использования БД: CATALOG_SOURCE=auto (или mongo), переменные MONGODB_* и коллекция Product после seed.'}
            </div>
          )}
          <dl>
            <dt>Секции радиаторов (всего по объекту)</dt>
            <dd>
              {displayedRadiatorSectionsTotal} <span>шт.</span>
              <span className={styles.radiatorsTotalSource}>
                {apiRadiatorsFromReport != null &&
                apiRadiatorsFromReport.lineEconomy?.emittersSummary != null &&
                apiRadiatorsFromReport.lineEfficient?.emittersSummary != null
                  ? ' — эконом / эффективный (панели и секции раздельно, из API)'
                  : apiRadiatorsFromReport != null &&
                      apiRadiatorsFromReport.byRoom.length > 0 &&
                      (apiRadiatorsFromReport.emittersSummary != null ||
                        apiRadiatorsFromReport.totalSections != null)
                    ? ' — агрегаты приборов из расчёта API'
                    : ' — черновая оценка до ответа сервера'}
              </span>
            </dd>

            {apiRadiatorsFromReport?.chosenModel && (
              <>
                <dt>Модель радиатора (подбор)</dt>
                <dd>{apiRadiatorsFromReport.chosenModel}</dd>
              </>
            )}

            {apiRadiatorsFromReport?.inputs != null
              && (apiRadiatorsFromReport.inputs.supplyC != null
                || apiRadiatorsFromReport.inputs.flowDeltaTK != null) && (
              <>
                <dt>График / Δt расхода радиаторов</dt>
                <dd>
                  {apiRadiatorsFromReport.inputs.supplyC != null
                    && apiRadiatorsFromReport.inputs.returnC != null
                    ? `${apiRadiatorsFromReport.inputs.supplyC}/${apiRadiatorsFromReport.inputs.returnC} °C`
                    : '—'}
                  {apiRadiatorsFromReport.inputs.targetDeltaT != null && (
                    <span className={styles.radiatorsTotalSource}>
                      {' '}
                      · ΔT_mean {apiRadiatorsFromReport.inputs.targetDeltaT} K
                    </span>
                  )}
                  {apiRadiatorsFromReport.inputs.radiatorConnection != null && (
                    <span className={styles.radiatorsTotalSource}>
                      {' '}
                      · подводка{' '}
                      {apiRadiatorsFromReport.inputs.radiatorConnection === 'bottom'
                        ? 'нижняя'
                        : 'боковая'}
                    </span>
                  )}
                  {apiRadiatorsFromReport.resolvedEmitterKind != null && (
                    <span className={styles.radiatorsTotalSource}>
                      {' '}
                      · тип{' '}
                      {apiRadiatorsFromReport.resolvedEmitterKind === 'panel'
                        ? 'панельные'
                        : 'секционные'}
                    </span>
                  )}
                  {apiRadiatorsFromReport.inputs.flowDeltaTK != null && (
                    <span className={styles.radiatorsTotalSource}>
                      {' '}
                      · Δt расхода {apiRadiatorsFromReport.inputs.flowDeltaTK} K
                    </span>
                  )}
                </dd>
              </>
            )}

            {apiRadiatorsFromReport != null &&
              !(apiBoilerFromReport?.tierEconomy || apiBoilerFromReport?.tierEfficient) &&
              (apiRadiatorsFromReport.lineEconomy != null ||
                apiRadiatorsFromReport.lineEfficient != null) && (
                <>
                  <dt>Секции радиаторов по вариантам</dt>
                  <dd className={styles.radiatorsByRoomDd}>
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
                  </dd>
                </>
              )}

            <dt>Мощность котла (итого)</dt>
            <dd>
              {formatKw(apiBoilerKw ?? quickEstimate.boilerKw)} <span>кВт</span>
            </dd>
          </dl>

          {apiRadiatorsFromReport != null && apiRadiatorsFromReport.warnings.length > 0 && (
            <ul className={styles.radiatorsWarningsList}>
              {apiRadiatorsFromReport.warnings.map((w, i) => (
                <li key={`rad-w-${i}-${w.slice(0, 80)}`}>{w}</li>
              ))}
            </ul>
          )}

          {apiBoilerFromReport?.summary != null && (() => {
            const boilerLabels = getBoilerUiLabels(
              apiBoilerFromReport.summary.hotWaterBoilerPowerMatchingScheme,
              objectType,
            );
            return (
              <div className={styles.boilerCalcSummary}>
                <h4 className={styles.boilerCalcSummaryTitle}>
                  {boilerLabels.summaryHeadline}
                </h4>
                <dl className={styles.boilerCalcDl}>
                  <dt>Теплопотери здания</dt>
                  <dd>
                    {formatKw(apiBoilerFromReport.summary.heatLossKw)} <span>кВт</span>
                  </dd>
                  <dt>
                    Запас на отопление (×
                    {formatCoefficient(apiBoilerFromReport.summary.reserveFactor)})
                  </dt>
                  <dd>
                    {formatKw(apiBoilerFromReport.summary.heatingLoadKw)} <span>кВт</span>
                  </dd>
                  <dt>{boilerLabels.dhwPartLabel}</dt>
                  <dd>
                    {formatKw(apiBoilerFromReport.summary.hotWaterPowerKw)} <span>кВт</span>
                  </dd>
                  <dt className={styles.totalLabel}>{boilerLabels.requiredKwLabel}</dt>
                  <dd className={styles.totalValue}>
                    {formatKw(apiBoilerFromReport.summary.requiredKw)} <span>кВт</span>
                  </dd>
                  {apiBoilerFromReport.summary.condensingHeatingReserveFactor != null &&
                    apiBoilerFromReport.summary.heatingLoadKwCondensing != null &&
                    apiBoilerFromReport.summary.requiredKwForCondensingLine != null && (
                      <>
                        <dt>
                          Запас на отопление для линии «Эффективный» (×
                          {formatCoefficient(
                            apiBoilerFromReport.summary.condensingHeatingReserveFactor,
                          )}
                          )
                        </dt>
                        <dd>
                          {formatKw(apiBoilerFromReport.summary.heatingLoadKwCondensing)}{' '}
                          <span>кВт</span>
                        </dd>
                        <dt className={styles.totalLabel}>
                          {boilerLabels.condensingRequiredLabel}
                        </dt>
                        <dd className={styles.totalValue}>
                          {formatKw(apiBoilerFromReport.summary.requiredKwForCondensingLine)}{' '}
                          <span>кВт</span>
                        </dd>
                      </>
                    )}
                </dl>
              </div>
            );
          })()}

          {apiBoilerFromReport != null && apiBoilerFromReport.warnings.length > 0 && (
            <ul className={styles.boilerWarningsList}>
              {apiBoilerFromReport.warnings.map((w, i) => (
                <li key={`${i}-${w.slice(0, 96)}`}>{w}</li>
              ))}
            </ul>
          )}

          {apiBoilerFromReport != null &&
            (apiBoilerFromReport.tierEconomy != null ||
              apiBoilerFromReport.tierEfficient != null) && (
              <>
                <p className={styles.hint} style={{ marginTop: 10 }}>
                  Два варианта под один и тот же расчёт — удобно сравнить по бюджету и режимам
                  работы горячей воды.
                </p>
                <div className={styles.boilerChoiceGrid}>
                  {apiBoilerFromReport.tierEconomy != null && (
                    <div className={styles.boilerChoiceColumn}>
                      <BoilerProposalCard
                        proposal={apiBoilerFromReport.tierEconomy}
                        catalogSource={apiCatalogSource}
                        sectionTitle={getBoilerUiLabels(
                          apiBoilerFromReport.summary?.hotWaterBoilerPowerMatchingScheme ??
                            SCHEME_BOILER_MAX_COMBI,
                          objectType,
                        ).proposalEconomyTitle}
                        titleDomId="boiler-proposal-economy"
                      />
                      <RadiatorProposalLineTable
                        line={apiRadiatorsFromReport?.lineEconomy ?? null}
                        caption="Радиаторы · вариант 1"
                        tableId="radiators-under-economy"
                      />
                    </div>
                  )}
                  {apiBoilerFromReport.tierEfficient != null && (
                    <div className={styles.boilerChoiceColumn}>
                      <BoilerProposalCard
                        proposal={apiBoilerFromReport.tierEfficient}
                        catalogSource={apiCatalogSource}
                        sectionTitle={getBoilerUiLabels(
                          apiBoilerFromReport.summary?.hotWaterBoilerPowerMatchingScheme ??
                            SCHEME_BOILER_MAX_COMBI,
                          objectType,
                        ).proposalEfficientTitle}
                        titleDomId="boiler-proposal-efficient"
                      />
                      <RadiatorProposalLineTable
                        line={apiRadiatorsFromReport?.lineEfficient ?? null}
                        caption="Радиаторы · вариант 2"
                        tableId="radiators-under-efficient"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

          {apiBoilerFromReport != null &&
            apiBoilerFromReport.tierEconomy == null &&
            apiBoilerFromReport.tierEfficient == null &&
            apiBoilerFromReport.legacyProposal != null && (
              <BoilerProposalCard
                proposal={apiBoilerFromReport.legacyProposal}
                catalogSource={apiCatalogSource}
              />
            )}
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
