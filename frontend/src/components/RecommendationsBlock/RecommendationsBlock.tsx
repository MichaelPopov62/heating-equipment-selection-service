/**
 * Назначение: Боковая панель рекомендаций по расчёту.
 * Описание: Теплопотери, котёл, радиаторы, бойлеры и предупреждения из JSON-отчёта.
 */

import type { RecommendationsBlockProps } from '../../types/recommendationsBlock';
import { SCHEME_BOILER_MAX_COMBI } from '../../types/heatingMatching';
import { getBoilerUiLabels } from '../../utils/boilerUiLabels';
import {
  formatAreaM2,
  formatCoefficient,
  formatFlowLps,
  formatHeatFluxWm2,
  formatKw,
  formatLiters,
  formatTempC,
  formatWatts,
} from '../../utils/format';
import { BoilerProposalCard } from '../BoilerProposalCard/BoilerProposalCard';
import { RadiatorProposalLineTable } from '../RadiatorProposalLineTable/RadiatorProposalLineTable';
import { WaterHeaterMatchingPreview } from '../WaterHeaterMatchingPreview/WaterHeaterMatchingPreview';
import { CatalogEquipmentReference } from '../CatalogEquipmentReference/CatalogEquipmentReference';
import { UfhMixingNodeSpecCard } from '../UnderfloorHeatingReport/UfhMixingNodeSpecCard';
import styles from './RecommendationsBlock.module.css';

export function RecommendationsBlock({
  className,
  quickEstimate,
  apiHeatLoss,
  apiHotWaterFromReport,
  apiBoilerFromReport,
  apiBoilerKw,
  apiRadiatorsFromReport,
  apiIndirectWhFromReport,
  apiElectricWhFromReport,
  apiUnderfloorHeatingFromReport,
  displayedRadiatorSectionsTotal,
  apiCatalogSource,
  apiAutomationHints,
  objectType,
  catalogSnap,
  catalogSnapLoading,
  catalogSnapError,
  onRetryLoadCatalog,
  onApplyScheme,
}: RecommendationsBlockProps) {
  return (
    <aside className={[styles.root, className].filter(Boolean).join(' ')}>
      <section aria-labelledby="calculation-results-title">
        <h2 id="calculation-results-title">Результаты расчета</h2>

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

        {apiUnderfloorHeatingFromReport != null &&
          apiUnderfloorHeatingFromReport.rooms.length > 0 && (
            <div className={styles.summaryGroup} aria-labelledby="underfloor-heating-title">
              <h3 id="underfloor-heating-title">Тёплый пол</h3>
              <div className={styles.hint} style={{ marginBottom: 8 }}>
                Источник: расчёт API (warmFloorCalc) · контур{' '}
                {apiUnderfloorHeatingFromReport.circuitSupplyC}/
                {apiUnderfloorHeatingFromReport.circuitReturnC} °C
                {apiUnderfloorHeatingFromReport.circuitSource === 'mixed_default'
                  ? ' (типичный смесительный узел)'
                  : apiUnderfloorHeatingFromReport.circuitSource === 'finish_preset'
                    ? ' (по финишу покрытия)'
                    : apiUnderfloorHeatingFromReport.circuitSource === 'ufh_mode_preset'
                      ? ' (пресет режима ТП)'
                      : ''}
                {apiUnderfloorHeatingFromReport.isMixingNodeRequired
                  ? ' · требуется смесительный узел'
                  : ''}
              </div>
              {apiUnderfloorHeatingFromReport.mixingNode != null && (
                <UfhMixingNodeSpecCard mixingNode={apiUnderfloorHeatingFromReport.mixingNode} />
              )}
              {apiUnderfloorHeatingFromReport.underfloorHydraulics != null && (
                <dl style={{ marginTop: 10 }}>
                  <dt>Гидравлика контура ТП</dt>
                  <dd>
                    Δt = {apiUnderfloorHeatingFromReport.underfloorHydraulics.deltaTK} K, расход{' '}
                    {apiUnderfloorHeatingFromReport.underfloorHydraulics.flowRateM3PerHour} м³/ч
                  </dd>
                </dl>
              )}
              <dl>
                <dt>Суммарная отдача вверх</dt>
                <dd>
                  {formatKw(apiUnderfloorHeatingFromReport.totalHeatFluxUpWatts / 1000, 2)}{' '}
                  <span>кВт</span>
                  <span className={styles.radiatorsTotalSource}>
                    {' '}
                    ({formatWatts(apiUnderfloorHeatingFromReport.totalHeatFluxUpWatts)} Вт)
                  </span>
                </dd>
                <dt>Паразитный поток вниз</dt>
                <dd>
                  {formatKw(apiUnderfloorHeatingFromReport.totalHeatFluxDownWatts / 1000, 2)}{' '}
                  <span>кВт</span>
                  <span className={styles.radiatorsTotalSource}>
                    {' '}
                    ({formatWatts(apiUnderfloorHeatingFromReport.totalHeatFluxDownWatts)} Вт)
                  </span>
                </dd>
              </dl>
              {apiUnderfloorHeatingFromReport.rooms.map((room) => (
                <div key={room.roomId} className={styles.boilerCalcSummary} style={{ marginTop: 10 }}>
                  <h4 className={styles.boilerCalcSummaryTitle}>{room.roomName}</h4>
                  <dl className={styles.boilerCalcDl}>
                    <dt>Основа</dt>
                    <dd>{room.basePresetName}</dd>
                    <dt>Покрытие</dt>
                    <dd>{room.finishMaterialName}</dd>
                    <dt>Шаг укладки</dt>
                    <dd>
                      {room.pipeSpacingMm} <span>мм</span>
                      <span className={styles.radiatorsTotalSource}>
                        {' '}
                        (R_embed {room.pipeEmbedmentResistanceM2KW.toFixed(3)} м²·K/Вт)
                      </span>
                    </dd>
                    <dt>q↑ (в комнату)</dt>
                    <dd>
                      {formatHeatFluxWm2(room.heatFluxUpWm2)} <span>Вт/м²</span> (
                      {formatWatts(room.heatFluxUpWatts)} Вт)
                    </dd>
                    <dt>q↓ (вниз)</dt>
                    <dd>
                      {formatHeatFluxWm2(room.heatFluxDownWm2)} <span>Вт/м²</span> (
                      {formatWatts(room.heatFluxDownWatts)} Вт)
                    </dd>
                    <dt>T поверхности</dt>
                    <dd
                      className={
                        room.surfaceTempC > room.maxSurfaceTemperatureCelsius
                        || (room.comfortMaxSurfaceTemperatureCelsius != null
                          && room.surfaceTempC > room.comfortMaxSurfaceTemperatureCelsius)
                          ? styles.totalValue
                          : undefined
                      }
                    >
                      {formatTempC(room.surfaceTempC)} <span>°C</span>
                      <span className={styles.radiatorsTotalSource}>
                        {' '}
                        (
                        {room.presetMaxSurfaceTemperatureCelsius != null
                          ? `применённый лимит ${formatTempC(room.maxSurfaceTemperatureCelsius)} °C`
                          : `лимит материала ${formatTempC(room.maxSurfaceTemperatureCelsius)} °C`}
                        {room.finishMaxSurfaceTemperatureCelsius != null
                          && room.presetMaxSurfaceTemperatureCelsius != null
                          && room.finishMaxSurfaceTemperatureCelsius
                            > room.presetMaxSurfaceTemperatureCelsius
                          ? `, паспорт покрытия ${formatTempC(room.finishMaxSurfaceTemperatureCelsius)} °C`
                          : ''}
                        {room.comfortMaxSurfaceTemperatureCelsius != null
                          ? `, комфорт ${formatTempC(room.comfortMaxSurfaceTemperatureCelsius)} °C`
                          : ''}
                        )
                      </span>
                    </dd>
                    <dt>Rλ,B финиша</dt>
                    <dd>
                      {room.finishCoveringResistanceM2KW.toFixed(4)} <span>м²·K/Вт</span>
                    </dd>
                    <dt>Rλ,B (основа + финиш)</dt>
                    <dd>
                      {room.coveringResistanceM2KW.toFixed(4)} <span>м²·K/Вт</span>
                    </dd>
                    {room.maxAllowableHeatFluxUpWm2 > 0 && (
                      <>
                        <dt>q↑ допустимо при лимите T</dt>
                        <dd>
                          {formatHeatFluxWm2(room.maxAllowableHeatFluxUpWm2)} <span>Вт/м²</span>
                        </dd>
                      </>
                    )}
                  </dl>
                  {room.warnings.length > 0 && (
                    <ul className={styles.radiatorsWarningsList}>
                      {room.warnings.map((w, i) => (
                        <li key={`ufh-room-${room.roomId}-${i}`}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {apiUnderfloorHeatingFromReport.warnings.length > 0 && (
                <ul className={styles.radiatorsWarningsList}>
                  {apiUnderfloorHeatingFromReport.warnings.map((w, i) => (
                    <li key={`ufh-global-${i}`}>{w}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

        {/* Группа: Водоснабжение */}
        <div className={styles.summaryGroup} aria-labelledby="hotWater-title">
          <h3 id="hotWater-title">Горячая вода</h3>
          <div className={styles.hint} style={{ marginBottom: 8 }}>
            {apiHotWaterFromReport == null
              ? 'Источник: после расчёта API'
              : apiHotWaterFromReport.dhwSupplyScenario === 'storage'
                ? 'Сценарий API: дом — накопитель (объём бака и мощность для котла от нагрева бака; пик расхода ниже — справочно).'
                : 'Сценарий API: квартира — проточный пик (мощность на нагрев от расхода и ΔT).'}
          </div>
          <dl>
            <dt>Пиковый расход горячей воды</dt>
            <dd>
              {formatFlowLps(
                apiHotWaterFromReport?.peakFlowLps ??
                  quickEstimate.hotWaterPeakFlowLitersPerSecond,
              )}{' '}
              <span>л/с</span>
            </dd>
            {apiHotWaterFromReport?.sumFlowLpsRaw != null && (
              <>
                <dt>Сумма расходов (без снижения)</dt>
                <dd>
                  {formatFlowLps(apiHotWaterFromReport.sumFlowLpsRaw)} <span>л/с</span>
                </dd>
              </>
            )}
            {apiHotWaterFromReport?.simultaneityFactor != null && (
              <>
                <dt>Коэффициент одновременности</dt>
                <dd>{formatCoefficient(apiHotWaterFromReport.simultaneityFactor)}</dd>
              </>
            )}
            <dt>Мощность на горячую воду для подбора котла</dt>
            <dd>
              {formatKw(
                apiHotWaterFromReport?.hotWaterPowerKw ?? quickEstimate.hotWaterPowerKilowatts,
              )}{' '}
              <span>кВт</span>
            </dd>
            {apiHotWaterFromReport?.dhwSupplyScenario === 'storage' &&
              apiHotWaterFromReport.peakThermalPowerKw != null && (
                <>
                  <dt>
                    Мощность при пиковом расходе (справочно, не для формулы котла)
                  </dt>
                  <dd>
                    {formatKw(apiHotWaterFromReport.peakThermalPowerKw)} <span>кВт</span>
                  </dd>
                </>
              )}
            <dt>Рекомендуемый накопитель</dt>
            <dd>
              {apiHotWaterFromReport != null &&
              apiHotWaterFromReport.recommendedTankLiters === 0
                ? 'Не применяется (проточный сценарий)'
                : apiHotWaterFromReport?.recommendedTankLiters != null
                  ? `${formatLiters(apiHotWaterFromReport.recommendedTankLiters)} л`
                  : '—'}
            </dd>
          </dl>
        </div>

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
                {apiRadiatorsFromReport?.lineEconomy?.totalSections != null &&
                apiRadiatorsFromReport?.lineEfficient?.totalSections != null
                  ? ' — эконом / эффективный (сумма по помещениям из API)'
                  : apiRadiatorsFromReport != null &&
                      apiRadiatorsFromReport.byRoom.length > 0 &&
                      apiRadiatorsFromReport.totalSections != null
                    ? ' — сумма по помещениям из расчёта API'
                    : ' — черновая оценка до ответа сервера'}
              </span>
            </dd>

            {apiRadiatorsFromReport?.chosenModel && (
              <>
                <dt>Модель радиатора (подбор)</dt>
                <dd>{apiRadiatorsFromReport.chosenModel}</dd>
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

          <WaterHeaterMatchingPreview
            idPrefix="sidebar"
            indirect={apiIndirectWhFromReport}
            electric={apiElectricWhFromReport}
          />

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
