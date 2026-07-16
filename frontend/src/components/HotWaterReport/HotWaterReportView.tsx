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
            <h4 className={styles.sectionTitle}>Точки водоразбора (из анкеты)</h4>
            <HotWaterFixturesTable fixtures={form.fixtures} />
          </>
        )}
        <p className={styles.hint} role="status">
          Расчётные показатели (пик расхода, мощность, бак) появятся после
          авторасчёта. Заполните помещения и ограждения, если расчёт ещё не
          запускался.
        </p>
      </div>
    );
  }

  const scenarioHint =
    hotWater.dhwSupplyScenario === 'storage'
      ? 'Сценарий API: дом — накопитель (объём бака и мощность для котла от нагрева бака; пик расхода ниже — справочно).'
      : hotWater.dhwSupplyScenario === 'flowThrough'
        ? 'Сценарий API: квартира — проточный пик (мощность на нагрев от расхода и ΔT).'
        : 'Сценарий ГВС из расчёта API.';

  const recommendedTankLabel =
    hotWater.recommendedTankLiters === 0
      ? 'Не применяется (проточный сценарий)'
      : hotWater.recommendedTankLiters != null
        ? `${formatLiters(hotWater.recommendedTankLiters)} л`
        : '—';

  const coldSeasonLabel =
    hotWater.coldWaterDesignSeason === 'summer'
      ? 'Лето (+15 °C)'
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
          <h4 className={styles.sectionTitle}>Точки водоразбора (из анкеты)</h4>
          <HotWaterFixturesTable fixtures={form.fixtures} />
        </>
      )}

      <h4 className={styles.sectionTitle}>Исходные параметры</h4>
      <dl className={styles.dl}>
        {hotWater.objectType != null && (
          <>
            <dt>Тип объекта</dt>
            <dd>{hotWater.objectType === 'apartment' ? 'Квартира' : 'Дом'}</dd>
          </>
        )}
        {hotWater.residents != null && (
          <>
            <dt>Число человек</dt>
            <dd>{hotWater.residents}</dd>
          </>
        )}
        {hotWater.tropicalShower != null && (
          <>
            <dt>Тропический душ</dt>
            <dd>{hotWater.tropicalShower ? 'да (+30 % к объёму бака)' : 'нет'}</dd>
          </>
        )}
        <dt>Расчётная ХВ</dt>
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

      <h4 className={styles.sectionTitle}>Расход и мощность</h4>
      <dl className={styles.dl}>
        {hotWater.sumFlowLpsRaw != null && (
          <>
            <dt>Сумма расходов (без снижения)</dt>
            <dd>
              {formatFlowLps(hotWater.sumFlowLpsRaw)} <span>л/с</span>
            </dd>
          </>
        )}
        {hotWater.simultaneityFactor != null && (
          <>
            <dt>Коэффициент одновременности β</dt>
            <dd>
              {formatCoefficient(hotWater.simultaneityFactor)}
              {hotWater.simultaneityBaseNorm != null && (
                <span className={styles.muted}>
                  {' '}
                  (база нормы {formatCoefficient(hotWater.simultaneityBaseNorm)})
                </span>
              )}
            </dd>
          </>
        )}
        <dt className={styles.totalLabel}>Пиковый расход горячей воды</dt>
        <dd className={styles.totalLabel}>
          {formatFlowLps(hotWater.peakFlowLps)} <span>л/с</span>
        </dd>
        <dt className={styles.totalLabel}>Мощность на ГВ для подбора котла</dt>
        <dd className={styles.totalLabel}>
          {formatKw(hotWater.hotWaterPowerKw)} <span>кВт</span>
        </dd>
        {hotWater.dhwSupplyScenario === 'storage'
          && hotWater.peakThermalPowerKw != null && (
            <>
              <dt>Мощность при пиковом расходе (справочно)</dt>
              <dd>
                {formatKw(hotWater.peakThermalPowerKw)} <span>кВт</span>
                <span className={styles.muted}> — не для формулы котла</span>
              </dd>
            </>
          )}
        <dt>Рекомендуемый накопитель</dt>
        <dd>{recommendedTankLabel}</dd>
      </dl>

      {hotWater.dhwSupplyScenario === 'storage' && (
        <>
          <h4 className={styles.sectionTitle}>Накопительный сценарий (дом)</h4>
          <dl className={styles.dl}>
            {hotWater.storageTankLitersPerPersonBasis != null && (
              <>
                <dt>Норма на человека</dt>
                <dd>
                  {formatLiters(hotWater.storageTankLitersPerPersonBasis)} л
                </dd>
              </>
            )}
            {hotWater.sessionDemandLitersMixed != null && (
              <>
                <dt>Сеансовый спрос (смешанная вода)</dt>
                <dd>{formatLiters(hotWater.sessionDemandLitersMixed)} л</dd>
              </>
            )}
            {hotWater.dhwEquivalentTankLitersFromSession != null && (
              <>
                <dt>Эквивалент бака по сеансу</dt>
                <dd>
                  {formatLiters(hotWater.dhwEquivalentTankLitersFromSession)} л
                </dd>
              </>
            )}
            {hotWater.dhwTankLitersCombinedRaw != null && (
              <>
                <dt>Объём до округления по типоразмерам</dt>
                <dd>{formatLiters(hotWater.dhwTankLitersCombinedRaw)} л</dd>
              </>
            )}
            {hotWater.storageHeatTimeMinutes != null && (
              <>
                <dt>Время нагрева бака (норма)</dt>
                <dd>{hotWater.storageHeatTimeMinutes} мин</dd>
              </>
            )}
            {hotWater.storageIndirectHeatPowerKw != null && (
              <>
                <dt>Мощность нагрева бака</dt>
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
