/**
 * Назначение: блок предложения по гидравлике (трубы + насос) для клиента.
 */

import type {
  ParsedHydraulicsCalculations,
  ParsedHydraulicsFlowContext,
  ParsedHydraulicsPipeLine,
  ParsedHydraulicsPipeLineGroup,
  ParsedHydraulicsProposal,
  ParsedHydraulicsPumpProposal,
  ParsedHydraulicsView,
} from '../../types/hydraulics';
import {
  formatBrandModel,
  formatPriceUah,
} from '../../utils/format';
import styles from './HydraulicsProposalSection.module.css';

type HydraulicsProposalSectionProps = {
  hydraulics: ParsedHydraulicsView | null;
  catalogSource?: 'file' | 'mongo' | null;
  calcLoading?: boolean;
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

function FlowContextBlock({ flowContext }: { flowContext: ParsedHydraulicsFlowContext }) {
  const hasGraph =
    flowContext.supplyC != null && flowContext.returnC != null;
  const hasFlowDt = flowContext.flowDeltaTK != null;
  if (!hasGraph && !hasFlowDt) return null;

  return (
    <dl className={styles.summaryDl}>
      {hasGraph && (
        <>
          <dt>Температурный график радиаторов</dt>
          <dd>
            {flowContext.supplyC}/{flowContext.returnC}{' '}
            <span className={styles.unit}>°C</span>
            {flowContext.thermalRegimeDeltaTK != null && (
              <span className={styles.hintInline}>
                {' '}
                (Δt графика {flowContext.thermalRegimeDeltaTK} K)
              </span>
            )}
          </dd>
        </>
      )}
      {hasFlowDt && (
        <>
          <dt>Δt для расчёта расхода (анкета)</dt>
          <dd>
            {flowContext.flowDeltaTK} <span className={styles.unit}>K</span>
            {flowContext.thermalRegimeDeltaTK != null
              && flowContext.flowDeltaTK !== flowContext.thermalRegimeDeltaTK && (
                <span className={styles.hintInline}>
                  {' '}
                  — отличается от Δt графика; расход Q = P/(c·Δt) считается по этому значению
                </span>
            )}
          </dd>
        </>
      )}
    </dl>
  );
}

function CalculationsSummary({
  calculations,
  proposal,
}: {
  calculations: ParsedHydraulicsCalculations;
  proposal: ParsedHydraulicsProposal | null;
}) {
  const flow =
    proposal != null && proposal.designFlowM3PerHour > 0
      ? proposal.designFlowM3PerHour
      : calculations.flowRateM3PerHour;
  const head =
    proposal != null && proposal.headRequiredM > 0
      ? proposal.headRequiredM
      : calculations.headRequiredM;

  if (flow <= 0 && head <= 0) return null;

  return (
    <dl className={styles.summaryDl}>
      <dt>Расчётный расход системы</dt>
      <dd>
        {flow.toFixed(3)} <span className={styles.unit}>м³/ч</span>
      </dd>
      <dt>Требуемый напор</dt>
      <dd>
        {head.toFixed(2)} <span className={styles.unit}>м</span>
      </dd>
      {calculations.deltaTSystemK != null && (
        <>
          <dt>Δt расхода (из расчёта)</dt>
          <dd>
            {calculations.deltaTSystemK} <span className={styles.unit}>K</span>
          </dd>
        </>
      )}
      {calculations.mainLineLengthM != null && calculations.mainLineLengthM > 0 && (
        <>
          <dt>Длина магистрали (анкета)</dt>
          <dd>
            {calculations.mainLineLengthM.toFixed(1)} <span className={styles.unit}>м</span>
          </dd>
        </>
      )}
      {calculations.recommendedPipeDiameter && (
        <>
          <dt>Ориентировочный DN (по расходу)</dt>
          <dd>{calculations.recommendedPipeDiameter}</dd>
        </>
      )}
    </dl>
  );
}

function PipeLinesTable({
  title,
  pipeLines,
  footerPrice,
}: {
  title: string;
  pipeLines: ParsedHydraulicsPipeLine[];
  footerPrice?: number;
}) {
  if (pipeLines.length === 0) return null;

  return (
    <div className={styles.tableWrap}>
      <h4 className={styles.subTitle}>{title}</h4>
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
          {pipeLines.map((line) => (
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
      {footerPrice != null && footerPrice > 0 && (
        <p className={styles.tableFooter}>
          Итого по контуру: <strong>{formatPriceUah(footerPrice)} грн</strong>
        </p>
      )}
    </div>
  );
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

function ProposalContent({
  proposal,
  catalogSource,
}: {
  proposal: ParsedHydraulicsProposal;
  catalogSource?: 'file' | 'mongo' | null;
}) {
  const sourceLine =
    catalogSource === 'mongo'
      ? 'Подбор по каталогу из базы данных (MongoDB).'
      : catalogSource === 'file'
        ? 'Подбор по каталогу из файла (локальные данные API).'
        : null;

  return (
    <>
      {sourceLine && <p className={styles.hint}>{sourceLine}</p>}

      {topologyLabel(proposal.topology) && (
        <p className={styles.hint}>{topologyLabel(proposal.topology)}</p>
      )}

      {(proposal.designFlowM3PerHour > 0 || proposal.headRequiredM > 0) && (
        <dl className={styles.summaryDl}>
          <dt>Расчётный расход контура (подбор)</dt>
          <dd>
            {proposal.designFlowM3PerHour.toFixed(3)} <span className={styles.unit}>м³/ч</span>
          </dd>
          <dt>Требуемый напор (подбор)</dt>
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
      )}

      {!proposal.hasPipeSelection && proposal.unavailableReason && (
        <p className={styles.emptyHint}>{proposal.unavailableReason}</p>
      )}

      {proposal.pumpUnavailableReason && proposal.pumps.length === 0 && (
        <p className={styles.hint}>{proposal.pumpUnavailableReason}</p>
      )}

      {proposal.pumps.length > 0 && (
        <div className={styles.pumpsList}>
          {proposal.pumps.map((p) => (
            <PumpCard key={p.zoneId} pump={p} />
          ))}
        </div>
      )}

      {proposal.pipeLineGroups.length > 0
        ? proposal.pipeLineGroups.map((group: ParsedHydraulicsPipeLineGroup) => (
            <PipeLinesTable
              key={group.circuitId}
              title={`Трубы — ${group.label}`}
              pipeLines={group.pipeLines}
              footerPrice={group.estimatedPrice}
            />
          ))
        : (
          <PipeLinesTable
            title="Трубы (сводка по позициям каталога)"
            pipeLines={proposal.pipeLines}
            footerPrice={
              proposal.estimatedPipesPrice > 0 ? proposal.estimatedPipesPrice : undefined
            }
          />
        )}

      {proposal.hasPipeSelection && proposal.estimatedPipesPrice > 0 && proposal.pipeLineGroups.length > 1 && (
        <p className={styles.tableFooter}>
          Итого по трубам: <strong>{formatPriceUah(proposal.estimatedPipesPrice)} грн</strong>
        </p>
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
                <tr
                  key={seg.edgeId}
                  className={
                    seg.velocityLimitExceeded || seg.velocityBelowMin
                      ? styles.segmentRowWarning
                      : undefined
                  }
                >
                  <td>
                    {seg.segmentLabel}
                    {seg.groupedRoomIds && seg.groupedRoomIds.length > 0 ? (
                      <span className={styles.hintInline}>
                        {' '}
                        (коллектор: {seg.groupedRoomIds.join(', ')})
                      </span>
                    ) : null}
                  </td>
                  <td>{segmentRoleLabel(seg.segmentRole)}</td>
                  <td>
                    {seg.lengthM.toFixed(1)} <span className={styles.unit}>м</span>
                  </td>
                  <td>{formatBrandModel(seg.brand, seg.model)}</td>
                  <td>
                    {seg.velocityMps.toFixed(2)} <span className={styles.unit}>м/с</span>
                    {seg.velocityLimitExceeded ? (
                      <span className={styles.hintInline}> (выше нормы)</span>
                    ) : null}
                    {seg.velocityBelowMin ? (
                      <span className={styles.hintInline}> (ниже нормы)</span>
                    ) : null}
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
    </>
  );
}

export function HydraulicsProposalSection({
  hydraulics,
  catalogSource,
  calcLoading = false,
}: HydraulicsProposalSectionProps) {
  const proposal = hydraulics?.proposal ?? null;
  const calculations = hydraulics?.calculations ?? null;
  const flowContext = hydraulics?.flowContext ?? null;
  const matchingWarnings = hydraulics?.matchingWarnings ?? [];

  const allWarnings = [
    ...matchingWarnings,
    ...(calculations?.notes ?? []),
  ];

  if (!hydraulics?.hasData) {
    return (
      <div className={styles.root} aria-labelledby="hydraulics-proposal-title">
        <h3 id="hydraulics-proposal-title" className={styles.title}>
          Гидравлика — рекомендуемое решение
        </h3>
        {calcLoading ? (
          <p className={styles.hint} role="status">
            Ожидание ответа сервера…
          </p>
        ) : (
          <p className={styles.emptyHint}>
            Заполните помещения и ограждения, затем дождитесь расчёта API — здесь появятся
            расход, напор и подбор труб/насоса. Параметры магистрали задаются на шаге
            «Гидравлика» слева.
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={[styles.root, calcLoading ? styles.rootStale : ''].filter(Boolean).join(' ')}
      aria-labelledby="hydraulics-proposal-title"
    >
      <h3 id="hydraulics-proposal-title" className={styles.title}>
        Гидравлика — рекомендуемое решение
      </h3>

      {calcLoading && (
        <p className={styles.hint} role="status">
          Обновление расчёта… показаны данные предыдущего ответа сервера.
        </p>
      )}

      <p className={styles.hint}>
        Источник: расчёт API (Pure Pipeline) · подбор труб и насоса из каталога.
      </p>

      {flowContext && <FlowContextBlock flowContext={flowContext} />}

      {calculations && (
        <CalculationsSummary calculations={calculations} proposal={proposal} />
      )}

      {proposal ? (
        <ProposalContent proposal={proposal} catalogSource={catalogSource} />
      ) : (
        calculations != null && (
          <p className={styles.hint}>
            Подбор позиций каталога не сформирован — см. предупреждения ниже или проверьте каталог
            труб/насосов.
          </p>
        )
      )}

      {allWarnings.length > 0 && (
        <ul className={styles.warningsList}>
          {allWarnings.map((w, i) => (
            <li key={`hyd-mw-${i}-${w.slice(0, 64)}`}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
