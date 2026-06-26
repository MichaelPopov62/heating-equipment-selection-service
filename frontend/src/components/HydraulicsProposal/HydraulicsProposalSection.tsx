/**
 * Назначение: блок предложения по гидравлике (трубы + насос) для клиента.
 */

import type { ParsedHydraulicsProposal, ParsedHydraulicsPumpProposal } from '../../types/hydraulics';
import {
  formatBrandModel,
  formatPriceUah,
} from '../../utils/format';
import styles from './HydraulicsProposalSection.module.css';

type HydraulicsProposalSectionProps = {
  proposal: ParsedHydraulicsProposal | null;
  catalogSource?: 'file' | 'mongo' | null;
};

function segmentRoleLabel(role: string): string {
  switch (role) {
    case 'main':
      return 'Магистраль';
    case 'branch':
      return 'Ветка';
    case 'ufh_loop':
      return 'Петля ТП';
    case 'dhw':
      return 'ГВС';
    default:
      return role;
  }
}

function topologyLabel(topology: ParsedHydraulicsProposal['topology']): string | null {
  switch (topology) {
    case 'direct':
      return 'Прямое подключение (суммарный расход контуров).';
    case 'mixing_valve':
      return 'Смесительный узел ТП — отдельный насос контура пола.';
    case 'hydraulic_separator':
      return 'Гидрострелка — первичный и зональные контуры.';
    default:
      return null;
  }
}

function PumpCard({ pump }: { pump: ParsedHydraulicsPumpProposal }) {
  return (
    <div className={styles.pumpCard} aria-labelledby={`hyd-pump-${pump.zoneId}`}>
      <h4 id={`hyd-pump-${pump.zoneId}`} className={styles.subTitle}>
        {pump.zoneLabel}
      </h4>
      {pump.note && <p className={styles.hint}>{pump.note}</p>}
      <dl className={styles.dl}>
        <dt>{pump.pumpSource === 'boiler_builtin' ? 'Котёл' : 'Модель'}</dt>
        <dd className={styles.valueStrong}>
          {formatBrandModel(pump.brand, pump.model)}
        </dd>
        <dt>Расчётный расход</dt>
        <dd>
          {pump.designFlowM3PerHour.toFixed(3)} <span className={styles.unit}>м³/ч</span>
        </dd>
        <dt>Режим работы</dt>
        <dd>{pump.modeName}</dd>
        <dt>Напор при расчётном расходе</dt>
        <dd>
          {pump.headAtDesignM.toFixed(2)} <span className={styles.unit}>м</span>
          {' '}
          <span className={styles.hintInline}>
            (запас {pump.headMarginPercent.toFixed(1)} %)
          </span>
        </dd>
        {pump.connectionNominalMm != null && (
          <>
            <dt>Условный диаметр подключения</dt>
            <dd>DN{pump.connectionNominalMm}</dd>
          </>
        )}
        {pump.price > 0 && (
          <>
            <dt>Цена в каталоге</dt>
            <dd className={styles.valueStrong}>
              {formatPriceUah(pump.price)} <span className={styles.unit}>грн</span>
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}

export function HydraulicsProposalSection({
  proposal,
  catalogSource,
}: HydraulicsProposalSectionProps) {
  if (!proposal) return null;

  const sourceLine =
    catalogSource === 'mongo'
      ? 'Подбор по каталогу из базы данных (MongoDB).'
      : catalogSource === 'file'
        ? 'Подбор по каталогу из файла (локальные данные API).'
        : null;

  return (
    <div className={styles.root} aria-labelledby="hydraulics-proposal-title">
      <h3 id="hydraulics-proposal-title" className={styles.title}>
        Гидравлика — рекомендуемое решение
      </h3>

      {sourceLine && <p className={styles.hint}>{sourceLine}</p>}

      {topologyLabel(proposal.topology) && (
        <p className={styles.hint}>{topologyLabel(proposal.topology)}</p>
      )}

      <dl className={styles.summaryDl}>
        <dt>Расчётный расход контура</dt>
        <dd>
          {proposal.designFlowM3PerHour.toFixed(3)} <span className={styles.unit}>м³/ч</span>
        </dd>
        <dt>Требуемый напор</dt>
        <dd>
          {proposal.headRequiredM.toFixed(2)} <span className={styles.unit}>м</span>
        </dd>
        {proposal.estimatedTotalPrice > 0 && (
          <>
            <dt>Ориентировочная стоимость (трубы + насос)</dt>
            <dd className={styles.valueStrong}>
              {formatPriceUah(proposal.estimatedTotalPrice)}{' '}
              <span className={styles.unit}>грн</span>
            </dd>
          </>
        )}
      </dl>

      {!proposal.hasCatalogSelection && (
        <p className={styles.emptyHint}>
          {proposal.unavailableReason ?? 'Подбор труб и насоса из каталога не выполнен.'}
        </p>
      )}

      {proposal.pumps.length > 0 && (
        <div className={styles.pumpsList}>
          {proposal.pumps.map((p) => (
            <PumpCard key={p.zoneId} pump={p} />
          ))}
        </div>
      )}

      {proposal.pipeLines.length > 0 && (
        <div className={styles.tableWrap}>
          <h4 className={styles.subTitle}>Трубы (сводка по позициям каталога)</h4>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Модель</th>
                <th>Материал</th>
                <th>Ø внутр.</th>
                <th>Длина</th>
                <th>Цена/м</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {proposal.pipeLines.map((line) => (
                <tr key={line.catalogPipeId}>
                  <td>{formatBrandModel(line.brand, line.model)}</td>
                  <td>{line.material || '—'}</td>
                  <td>
                    {line.internalDiameterMm.toFixed(1)} <span className={styles.unit}>мм</span>
                  </td>
                  <td>
                    {line.totalLengthM.toFixed(1)} <span className={styles.unit}>м</span>
                    {line.edgeCount > 1 ? (
                      <span className={styles.hintInline}> ({line.edgeCount} уч.)</span>
                    ) : null}
                  </td>
                  <td>
                    {line.pricePerMeter > 0
                      ? `${formatPriceUah(line.pricePerMeter)} грн`
                      : '—'}
                  </td>
                  <td>
                    {line.linePrice > 0
                      ? `${formatPriceUah(line.linePrice)} грн`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {proposal.estimatedPipesPrice > 0 && (
            <p className={styles.tableFooter}>
              Итого по трубам: <strong>{formatPriceUah(proposal.estimatedPipesPrice)} грн</strong>
            </p>
          )}
        </div>
      )}

      {proposal.pipeSegments.length > 0 && (
        <details className={styles.details}>
          <summary>Детализация по участкам ({proposal.pipeSegments.length})</summary>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Участок</th>
                <th>Тип</th>
                <th>Длина</th>
                <th>Труба</th>
                <th>v</th>
                <th>Δp</th>
              </tr>
            </thead>
            <tbody>
              {proposal.pipeSegments.map((seg) => (
                <tr key={seg.edgeId}>
                  <td>{seg.segmentLabel}</td>
                  <td>{segmentRoleLabel(seg.segmentRole)}</td>
                  <td>
                    {seg.lengthM.toFixed(1)} <span className={styles.unit}>м</span>
                  </td>
                  <td>{formatBrandModel(seg.brand, seg.model)}</td>
                  <td>
                    {seg.velocityMps.toFixed(2)} <span className={styles.unit}>м/с</span>
                  </td>
                  <td>
                    {seg.pressureDropKPa.toFixed(1)} <span className={styles.unit}>кПа</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {proposal.warnings.length > 0 && (
        <ul className={styles.warningsList}>
          {proposal.warnings.map((w, i) => (
            <li key={`hyd-w-${i}-${w.slice(0, 64)}`}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
