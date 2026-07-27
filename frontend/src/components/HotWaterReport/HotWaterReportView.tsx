/**
 * Назначение: Полный отчёт расчёта ГВС.
 * Описание: Точки — всегда из анкеты; расход/мощность — из API (если есть).
 */

import type { HotWaterFormValue } from '../../types/hotWater';
import type { ParsedHotWaterReport } from '../../types/hotWaterReport';
import {
  formatCoefficient,
  formatFlowLps,
  formatKw,
  formatLiters,
  formatTempC,
} from '../../utils/format';
import { hasHotWaterFixturesContent } from '../../utils/countThermalFixtures';
import { normalizeHotWaterForm } from '../../utils/normalizeHotWaterForm';
import { HotWaterFixturesTable } from './HotWaterFixturesTable';
import styles from './HotWaterReportView.module.css';

export type HotWaterReportViewProps = {
  /** Расчёт API; null — только точки анкеты + подсказка ожидания. */
  hotWater: ParsedHotWaterReport | null;
  /** Анкета ГВ (SSOT точек водоразбора). */
  formValue: HotWaterFormValue;
};

/**
 * @param props
 */
export function HotWaterReportView({
  hotWater,
  formValue,
}: HotWaterReportViewProps) {
  const form = normalizeHotWaterForm(formValue);
  const showFixtures = hasHotWaterFixturesContent(form.fixtures);

  if (hotWater == null) {
    return (
      <div>
        {showFixtures && (
          <>
            <h4 className={styles.sectionTitle}>Точки водорозбору (з анкети)</h4>
            <HotWaterFixturesTable fixtures={form.fixtures} />
          </>
        )}
        <p className={styles.hint} role="status">
          Розрахункові показники (пік витрати, потужність, бак) з&apos;являться після
          авторасчунку. Заповніть приміщення та огородження, якщо розрахунок ще не
          запускався.
        </p>
      </div>
    );
  }

  const scenarioHint =
    hotWater.dhwSupplyScenario === 'storage'
      ? 'Сценарій API: дім — накопичувальний (об\'єм бака і потужність для котла від нагрівання бака; пік витрати нижче — довідково).'
      : hotWater.dhwSupplyScenario === 'flowThrough'
        ? 'Сценарій API: квартира — проточний пік (потужність на нагрів від витрати та ΔT).'
        : 'Сценарій ГВП з розрахунку API.';

  const recommendedTankLabel =
    hotWater.recommendedTankLiters === 0
      ? 'Не застосовується (проточний сценарій)'
      : hotWater.recommendedTankLiters != null
        ? `${formatLiters(hotWater.recommendedTankLiters)} л`
        : '—';

  const coldSeasonLabel =
    hotWater.coldWaterDesignSeason === 'summer'
      ? 'Літо (+15 °C)'
      : hotWater.coldWaterDesignSeason === 'winter'
        ? 'Зима (+5 °C)'
        : '—';

  return (
    <div>
      <p className={styles.hint}>
        {scenarioHint}
        {hotWater.normsSchemaVersion != null && (
          <span className={styles.muted}>
            {' '}
            · water_norms v{hotWater.normsSchemaVersion}
          </span>
        )}
      </p>

      {showFixtures && (
        <>
          <h4 className={styles.sectionTitle}>Точки водорозбору (з анкети)</h4>
          <HotWaterFixturesTable fixtures={form.fixtures} />
        </>
      )}

      <h4 className={styles.sectionTitle}>Вихідні параметри</h4>
      <dl className={styles.dl}>
        {hotWater.objectType != null && (
          <>
            <dt>Тип об&apos;єкта</dt>
            <dd>{hotWater.objectType === 'apartment' ? 'Квартира' : 'Будинок'}</dd>
          </>
        )}
        {hotWater.residents != null && (
          <>
            <dt>Кількість людей</dt>
            <dd>{hotWater.residents}</dd>
          </>
        )}
        {hotWater.tropicalShower != null && (
          <>
            <dt>Тропічний душ</dt>
            <dd>{hotWater.tropicalShower ? 'так (+30 % до об\'єму бака)' : 'ні'}</dd>
          </>
        )}
        <dt>Розрахункова ХВ</dt>
        <dd>
          {coldSeasonLabel}
          {hotWater.designColdWaterC != null && (
            <span className={styles.muted}>
              {' '}
              · {formatTempC(hotWater.designColdWaterC)} °C
            </span>
          )}
        </dd>
        {hotWater.hotWaterC != null && (
          <>
            <dt>Температура ГВ</dt>
            <dd>{formatTempC(hotWater.hotWaterC)} °C</dd>
          </>
        )}
        {hotWater.deltaTK != null && (
          <>
            <dt>ΔT (ГВ − ХВ)</dt>
            <dd>{formatTempC(hotWater.deltaTK)} K</dd>
          </>
        )}
      </dl>

      <h4 className={styles.sectionTitle}>Витрата і потужність</h4>
      <dl className={styles.dl}>
        {hotWater.sumFlowLpsRaw != null && (
          <>
            <dt>Сума витрат (без зниження)</dt>
            <dd>
              {formatFlowLps(hotWater.sumFlowLpsRaw)} <span>л/с</span>
            </dd>
          </>
        )}
        {hotWater.simultaneityFactor != null && (
          <>
            <dt>Коефіцієнт одночасності β</dt>
            <dd>
              {formatCoefficient(hotWater.simultaneityFactor)}
              {hotWater.simultaneityBaseNorm != null && (
                <span className={styles.muted}>
                  {' '}
                  (база норми {formatCoefficient(hotWater.simultaneityBaseNorm)})
                </span>
              )}
            </dd>
          </>
        )}
        <dt className={styles.totalLabel}>Пікова витрата гарячої води</dt>
        <dd className={styles.totalLabel}>
          {formatFlowLps(hotWater.peakFlowLps)} <span>л/с</span>
        </dd>
        <dt className={styles.totalLabel}>Потужність на ГВ для підбору котла</dt>
        <dd className={styles.totalLabel}>
          {formatKw(hotWater.hotWaterPowerKw)} <span>кВт</span>
        </dd>
        {hotWater.dhwSupplyScenario === 'storage'
          && hotWater.peakThermalPowerKw != null && (
            <>
              <dt>Потужність при піковому витраті (довідково)</dt>
              <dd>
                {formatKw(hotWater.peakThermalPowerKw)} <span>кВт</span>
                <span className={styles.muted}> — не для формули котла</span>
              </dd>
            </>
          )}
        <dt>Рекомендований накопичувач</dt>
        <dd>{recommendedTankLabel}</dd>
      </dl>

      {hotWater.dhwSupplyScenario === 'storage' && (
        <>
          <h4 className={styles.sectionTitle}>Накопичувальний сценарій (дім)</h4>
          <dl className={styles.dl}>
            {hotWater.storageTankLitersPerPersonBasis != null && (
              <>
                <dt>Норма на людину</dt>
                <dd>
                  {formatLiters(hotWater.storageTankLitersPerPersonBasis)} л
                </dd>
              </>
            )}
            {hotWater.sessionDemandLitersMixed != null && (
              <>
                <dt>Сеансовий попит (змішана вода)</dt>
                <dd>{formatLiters(hotWater.sessionDemandLitersMixed)} л</dd>
              </>
            )}
            {hotWater.dhwEquivalentTankLitersFromSession != null && (
              <>
                <dt>Еквівалент бака за сеансом</dt>
                <dd>
                  {formatLiters(hotWater.dhwEquivalentTankLitersFromSession)} л
                </dd>
              </>
            )}
            {hotWater.dhwTankLitersCombinedRaw != null && (
              <>
                <dt>Об&apos;єм до округлення за типорозмірами</dt>
                <dd>{formatLiters(hotWater.dhwTankLitersCombinedRaw)} л</dd>
              </>
            )}
            {hotWater.storageHeatTimeMinutes != null && (
              <>
                <dt>Час нагрівання бака (норма)</dt>
                <dd>{hotWater.storageHeatTimeMinutes} хв</dd>
              </>
            )}
            {hotWater.storageIndirectHeatPowerKw != null && (
              <>
                <dt>Потужність нагрівання бака</dt>
                <dd>
                  {formatKw(hotWater.storageIndirectHeatPowerKw)} <span>кВт</span>
                </dd>
              </>
            )}
          </dl>
        </>
      )}
    </div>
  );
}
