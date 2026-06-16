/**
 * Назначение: Карточка подбора водонагревателя.
 * Описание: Отображение БКН или электробойлера из matching-узла отчёта расчёта.
 */

import {
  formatBrandModel,
  formatKw,
  formatLiters,
  formatPriceUah,
} from '../../utils/format';
import type { ParsedIndirectWaterHeaterMatching } from '../../utils/parseIndirectWaterHeaterMatchingFromReport';
import type { ParsedWaterHeaterMatching } from '../../utils/parseWaterHeaterMatchingFromReport';
import appStyles from '../../App.module.css';

type Props = {
  title: string;
  titleDomId: string;
  data: ParsedIndirectWaterHeaterMatching | ParsedWaterHeaterMatching;
  /** Специфичные для БКН поля (передаются только для indirect). */
  indirect?: {
    coilPowerKw: number | null;
    effectiveHeatPowerKw: number | null;
    heatTimeMinutesFullTank: number | null;
    skippedReason: string | null;
  };
  /** Мощность (только для ЭВН). */
  electricPowerKw?: number | null;
};

export function WaterHeaterProposalCard({
  title,
  titleDomId,
  data,
  indirect,
  electricPowerKw,
}: Props) {
  return (
    <div className={appStyles.boilerCalcSummary} aria-labelledby={titleDomId}>
      <h4 className={appStyles.boilerCalcSummaryTitle} id={titleDomId}>
        {title}
      </h4>
      {data.hasCatalogSelection ? (
        <dl className={appStyles.boilerCalcDl}>
          <dt>Модель (подбор)</dt>
          <dd>
            {data.selectedModel
              ? formatBrandModel(data.brand, data.selectedModel)
              : '—'}
          </dd>
          {data.volumeLiters != null && (
            <>
              <dt>Объём бака</dt>
              <dd>
                {formatLiters(data.volumeLiters)} <span>л</span>
              </dd>
            </>
          )}
          {data.requiredTankLiters > 0 && (
            <>
              <dt>Расчётный минимум по объёму</dt>
              <dd>
                {formatLiters(data.requiredTankLiters)} <span>л</span>
              </dd>
            </>
          )}
          {indirect && (
            <>
              {indirect.coilPowerKw != null && (
                <>
                  <dt>Мощность змеевика (каталог)</dt>
                  <dd>
                    {formatKw(indirect.coilPowerKw, 1)} <span>кВт</span>
                  </dd>
                </>
              )}
              {indirect.effectiveHeatPowerKw != null && (
                <>
                  <dt>Эффективная мощность нагрева (min котёл, змеевик)</dt>
                  <dd>
                    {formatKw(indirect.effectiveHeatPowerKw)} <span>кВт</span>
                  </dd>
                </>
              )}
              <dt>Время полного нагрева бака (оценка)</dt>
              <dd>
                {indirect.heatTimeMinutesFullTank != null ? (
                  <>
                    ~{indirect.heatTimeMinutesFullTank} <span>мин</span>
                    <span className={appStyles.hintInline}>
                      {' '}
                      при приоритете ГВС и указанной эффективной мощности; не норматив.
                    </span>
                  </>
                ) : (
                  '— (нет данных по мощности котла/змеевика)'
                )}
              </dd>
            </>
          )}
          {electricPowerKw != null && (
            <>
              <dt>Мощность нагрева (каталог)</dt>
              <dd>
                {formatKw(electricPowerKw, 1)} <span>кВт</span>
              </dd>
            </>
          )}
          {data.price != null && (
            <>
              <dt>Цена в каталоге</dt>
              <dd>
                {formatPriceUah(data.price)} <span>грн</span>
              </dd>
            </>
          )}
        </dl>
      ) : (
        <p className={appStyles.hint}>
          {indirect
            ? (indirect.skippedReason ?? 'БКН из каталога не выбран.')
            : 'Электробойлер из каталога не выбран.'}
        </p>
      )}
      {data.warnings.length > 0 && (
        <ul className={appStyles.boilerWarningsList}>
          {data.warnings.map((w, i) => (
            <li key={`wh-w-${i}-${w.slice(0, 96)}`}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
