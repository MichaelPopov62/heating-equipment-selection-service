/**
 * Назначение: Карточка предложения котла.
 * Описание: Мощность, цена, каскад, запас номинала и разбивка по контурам из отчёта.
 */

import {
  formatBrandModel,
  formatKw,
  formatLiters,
  formatPercent,
  formatPriceUah,
} from '../../utils/format';
import styles from './BoilerProposalCard.module.css';

/** Верхний предел процента запаса по отоплению при ограничении модуляцией (согласовано с matching/boiler.js). */
const HEATING_RESERVE_MODULATION_CAP_PERCENT = 150;

/** Фрагмент отчёта API: report.matching.boiler.proposal (+ proposalEconomy / proposalEfficient) */
export interface BoilerProposalPowerBreakdownView {
  heatingLoadKw: number;
  hotWaterPowerKw: number;
}

export interface EquipmentBundlePriceBreakdownView {
  boilerPrice?: number;
  waterHeaterPrice?: number;
  indirectWaterHeaterPrice?: number;
}

export interface EquipmentBundleCompanionView {
  role: 'water_heater' | 'indirect_water_heater';
  model: string;
  brand?: string;
  volumeLiters?: number;
  price?: number;
}

export interface BoilerProposalView {
  kind: 'single' | 'cascade';
  headline: string;
  model: string;
  unitsCount: number;
  unitMaxPowerKw: number;
  totalNominalKw: number;
  requiredKw: number;
  /** Строки «из них на отопление / ГВС» в блоке цифр. */
  powerRequirementBreakdown: BoilerProposalPowerBreakdownView;
  nominalReservePercent: number;
  /** Линия подбора с API (economy | efficient). */
  tier?: 'economy' | 'efficient';
  estimatedTotalPrice?: number;
  /** Сумма котла и сопутствующего ГВС-оборудования (электробойлер и/или БКН). */
  equipmentBundleTotalPrice?: number;
  equipmentBundlePriceBreakdown?: EquipmentBundlePriceBreakdownView;
  equipmentBundleCompanions?: EquipmentBundleCompanionView[];
  mountingType?: 'wall' | 'floor';
  connectionDiameters?: string[];
  advantages: string[];
  notes: string[];
}

function companionRoleLabel(role: EquipmentBundleCompanionView['role']): string {
  return role === 'water_heater' ? 'Електробойлер' : 'БКН';
}

function formatCompanionLine(c: EquipmentBundleCompanionView): string {
  const title = formatBrandModel(c.brand, c.model);
  if (c.volumeLiters != null) {
    return `${title}, ${formatLiters(c.volumeLiters)} л`;
  }
  return title;
}

function mountingLabel(m?: string): string | null {
  if (m === 'wall') return 'настінний';
  if (m === 'floor') return 'напольний';
  return null;
}

export function BoilerProposalCard({
  proposal,
  catalogSource,
  sectionTitle = 'Рекомендоване рішення',
  titleDomId = 'boiler-proposal-title',
}: {
  proposal: BoilerProposalView;
  catalogSource?: 'file' | 'mongo' | null;
  /** Заголовок карточки (например «Вариант: эконом класс»). */
  sectionTitle?: string;
  /** Уникальный id для aria-labelledby при нескольких карточках. */
  titleDomId?: string;
}) {
  const mount = mountingLabel(proposal.mountingType);
  const qtyLabel =
    proposal.kind === 'cascade'
      ? `${proposal.unitsCount} од. (каскад)`
      : `${proposal.unitsCount} од.`;

  const sourceLine =
    catalogSource === 'mongo'
      ? 'Підбір за каталогом із бази даних (MongoDB).'
      : catalogSource === 'file'
        ? 'Підбір за каталогом із файлу (локальні дані API).'
        : null;

  const { heatingLoadKw: heatPart, hotWaterPowerKw: dhwPart } =
    proposal.powerRequirementBreakdown;

  const reserveLabel =
    proposal.kind === 'single' ? 'Запас за опаленням' : 'Запас за номіналом до розрахунку';
  const reservePctFormatted =
    proposal.kind === 'single' && Number.isInteger(proposal.nominalReservePercent)
      ? String(proposal.nominalReservePercent)
      : formatPercent(proposal.nominalReservePercent);
  const reservePctSigned =
    proposal.nominalReservePercent > 0
      ? `+${reservePctFormatted}`
      : reservePctFormatted;
  const modulationCapped =
    proposal.kind === 'single' &&
    proposal.nominalReservePercent >= HEATING_RESERVE_MODULATION_CAP_PERCENT;

  return (
    <div className={styles.card} aria-labelledby={titleDomId}>
      <h4 id={titleDomId} className={styles.title}>
        {sectionTitle}
      </h4>
      {sourceLine != null && <p className={styles.catalogSource}>{sourceLine}</p>}
      <div className={styles.powerBlock}>
        <p className={styles.powerPeak}>
          Необхідна потужність:{' '}
          <strong>{formatKw(proposal.requiredKw)} кВт</strong>
        </p>
        <p className={styles.powerSub}>
          ── з них на опалення: <strong>{formatKw(heatPart)} кВт</strong>
        </p>
        <p className={styles.powerSub}>
          ── з них на гарячу воду (ГВП):{' '}
          <strong>{formatKw(dhwPart)} кВт</strong>
        </p>
      </div>
      <p className={styles.solutionLine}>
        Запропоноване рішення: {proposal.headline} —{' '}
        <strong>{formatKw(proposal.totalNominalKw, 1)} кВт</strong>
      </p>
      <p className={styles.heatingReserveLine}>
        {reserveLabel}: {reservePctSigned}%
        {modulationCapped ? (
          <span className={styles.modHint}> (обмежено модуляцією)</span>
        ) : null}
      </p>
      <dl className={styles.dl}>
        <dt>Котел</dt>
        <dd>{proposal.model}</dd>
        {proposal.equipmentBundleCompanions?.map((c, i) => (
          <div key={`${c.role}-${i}-${c.model}`} className={styles.companionPair}>
            <dt>{companionRoleLabel(c.role)}</dt>
            <dd>{formatCompanionLine(c)}</dd>
          </div>
        ))}
        <dt>Кількість</dt>
        <dd>{qtyLabel}</dd>
        {proposal.estimatedTotalPrice != null && (
          <>
            <dt>Орієнтовна вартість котла</dt>
            <dd>
              {formatPriceUah(proposal.estimatedTotalPrice)}{' '}
              грн
              {proposal.unitsCount > 1 ? ' (усі одиниці)' : ''}
            </dd>
          </>
        )}
        {proposal.equipmentBundleTotalPrice != null && (
          <>
            <dt className={styles.bundleTotalLabel}>Разом за варіантом</dt>
            <dd className={styles.bundleTotalValue}>
              {formatPriceUah(proposal.equipmentBundleTotalPrice)} грн
              {proposal.equipmentBundlePriceBreakdown != null && (
                <ul className={styles.bundleBreakdown}>
                  {proposal.equipmentBundlePriceBreakdown.boilerPrice != null && (
                    <li>
                      Котел:{' '}
                      {formatPriceUah(
                        proposal.equipmentBundlePriceBreakdown.boilerPrice,
                      )}{' '}
                      грн
                    </li>
                  )}
                  {proposal.equipmentBundlePriceBreakdown.waterHeaterPrice !=
                    null && (
                    <li>
                      Електробойлер:{' '}
                      {formatPriceUah(
                        proposal.equipmentBundlePriceBreakdown.waterHeaterPrice,
                      )}{' '}
                      грн
                    </li>
                  )}
                  {proposal.equipmentBundlePriceBreakdown
                    .indirectWaterHeaterPrice != null && (
                    <li>
                      БКН:{' '}
                      {formatPriceUah(
                        proposal.equipmentBundlePriceBreakdown
                          .indirectWaterHeaterPrice,
                      )}{' '}
                      грн
                    </li>
                  )}
                </ul>
              )}
            </dd>
          </>
        )}
        {mount != null && (
          <>
            <dt>Тип установки</dt>
            <dd>{mount}</dd>
          </>
        )}
        {proposal.connectionDiameters != null && proposal.connectionDiameters.length > 0 && (
          <>
            <dt>Приєднання</dt>
            <dd>{proposal.connectionDiameters.join(', ')}</dd>
          </>
        )}
      </dl>
      {proposal.advantages.length > 0 && (
        <div className={styles.block}>
          <div className={styles.blockTitle}>Переваги</div>
          <ul className={styles.list}>
            {proposal.advantages.map((t, i) => (
              <li key={`${i}-${t.slice(0, 40)}`}>{t}</li>
            ))}
          </ul>
        </div>
      )}
      {proposal.notes.length > 0 && (
        <div className={styles.notes}>
          {proposal.notes.map((t, i) => (
            <p key={`${i}-${t.slice(0, 40)}`} className={styles.note}>
              {t}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
