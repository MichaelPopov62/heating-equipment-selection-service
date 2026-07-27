/**
 * Призначення: повний звіт гідравліки (труби + насос).
 * Опис: Тіло модалки кроку «Гидравлика»; деталізація не дублюється в «Рекомендації».
 */

import type {
  ParsedHydraulicsCalculations,
  ParsedHydraulicsFlowContext,
  ParsedHydraulicsPipeLine,
  ParsedHydraulicsPipeLineGroup,
  ParsedHydraulicsProposal,
  ParsedHydraulicsView,
} from '../../types/hydraulics';
import {
  formatBrandModel,
  formatPriceUah,
} from '../../utils/format';
import { excludeUfhZonePumps } from '../../utils/ufhHydraulicsPumps';
import { HydraulicsPumpCard } from '../HydraulicsProposal/HydraulicsPumpCard';
import styles from './HydraulicsReportView.module.css';

export type HydraulicsReportViewProps = {
  hydraulics: ParsedHydraulicsView;
  catalogSource?: 'file' | 'mongo' | null;
};

/**
 * @param role
 * @param isMainLine
 */
function segmentRoleLabel(
  role: string,
  isMainLine?: boolean,
): string {
  if (isMainLine) return 'Транзит котла';
  switch (role) {
    case 'main':
      return 'Магістраль';
    case 'branch':
      return 'Гілка';
    case 'ufh_loop':
      return 'Петля ТП';
    case 'dhw':
      return 'ГВП';
    default:
      return role;
  }
}

/**
 * @param topology
 */
function topologyLabel(topology: ParsedHydraulicsProposal['topology']): string | null {
  switch (topology) {
    case 'direct':
      return 'Пряме підключення (сума витрат контурів).';
    case 'mixing_valve':
      return 'Змішувальний вузол ТП — насос контуру підлоги у звіті кроку «Тепла підлога».';
    case 'hydraulic_separator':
      return 'Гідрострелка — первинний контур тут; насос ТП у звіті кроку «Тепла підлога».';
    default:
      return null;
  }
}

/**
 * @param props
 */
function FlowContextBlock({ flowContext }: { flowContext: ParsedHydraulicsFlowContext }) {
  const hasGraph =
    flowContext.supplyC != null && flowContext.returnC != null;
  const hasFlowDt = flowContext.flowDeltaTK != null;
  if (!hasGraph && !hasFlowDt) return null;

  return (
    <dl className={styles.summaryDl}>
      {hasGraph && (
        <>
          <dt>Температурний графік радіаторів</dt>
          <dd>
            {flowContext.supplyC}/{flowContext.returnC}{' '}
            <span className={styles.unit}>°C</span>
            {flowContext.thermalRegimeDeltaTK != null && (
              <span className={styles.hintInline}>
                {' '}
                (Δt графіка {flowContext.thermalRegimeDeltaTK} K)
              </span>
            )}
          </dd>
        </>
      )}
      {hasFlowDt && (
        <>
          <dt>Δt для розрахунку витрати (анкета)</dt>
          <dd>
            {flowContext.flowDeltaTK} <span className={styles.unit}>K</span>
            {flowContext.thermalRegimeDeltaTK != null
              && flowContext.flowDeltaTK !== flowContext.thermalRegimeDeltaTK && (
                <span className={styles.hintInline}>
                  {' '}
                  — відрізняється від Δt графіка; витрата Q = P/(c·Δt) рахується за цим значенням
                </span>
            )}
          </dd>
        </>
      )}
    </dl>
  );
}

/**
 * @param props
 */
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
      <dt>Розрахунковий витрат системи</dt>
      <dd>
        {flow.toFixed(3)} <span className={styles.unit}>м³/ч</span>
      </dd>
      <dt>Необхідний напір</dt>
      <dd>
        {head.toFixed(2)} <span className={styles.unit}>м</span>
      </dd>
      {calculations.deltaTSystemK != null && (
        <>
          <dt>Δt витрати (з розрахунку)</dt>
          <dd>
            {calculations.deltaTSystemK} <span className={styles.unit}>K</span>
          </dd>
        </>
      )}
      {calculations.mainLineLengthM != null && calculations.mainLineLengthM > 0 && (
        <>
          <dt>Довжина магістралі (анкета)</dt>
          <dd>
            {calculations.mainLineLengthM.toFixed(1)} <span className={styles.unit}>м</span>
          </dd>
        </>
      )}
      {calculations.recommendedPipeDiameter != null
        && calculations.recommendedPipeDiameter.length > 0 && (
        <>
          <dt>Орієнтовний DN (за витратою)</dt>
          <dd>{calculations.recommendedPipeDiameter}</dd>
        </>
      )}
    </dl>
  );
}

/**
 * @param props
 */
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
            <th>Матеріал</th>
            <th>Ø внутр.</th>
            <th>Довжина</th>
            <th>Ціна/м</th>
            <th>Сума</th>
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
                  <span className={styles.hintInline}> ({line.edgeCount} ділян.)</span>
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
          Разом за контуром: <strong>{formatPriceUah(footerPrice)} грн</strong>
        </p>
      )}
    </div>
  );
}

/**
 * @param props
 */
function ProposalContent({
  proposal,
  catalogSource,
}: {
  proposal: ParsedHydraulicsProposal;
  catalogSource: 'file' | 'mongo' | null;
}) {
  const sourceLine =
    catalogSource === 'mongo'
      ? 'Підбір за каталогом із бази даних (MongoDB).'
      : catalogSource === 'file'
        ? 'Підбір за каталогом із файлу (локальні дані API).'
        : null;

  /** Зони ТП — лише в звіті кроку «Тёплый пол». */
  const pumpsForHydraulics = excludeUfhZonePumps(proposal.pumps);
  const topologyText = topologyLabel(proposal.topology);

  return (
    <>
      {sourceLine != null && <p className={styles.hint}>{sourceLine}</p>}

      {topologyText != null && (
        <p className={styles.hint}>{topologyText}</p>
      )}

      {(proposal.designFlowM3PerHour > 0 || proposal.headRequiredM > 0) && (
        <dl className={styles.summaryDl}>
          <dt>Розрахунковий витрат контуру (підбір)</dt>
          <dd>
            {proposal.designFlowM3PerHour.toFixed(3)} <span className={styles.unit}>м³/ч</span>
          </dd>
          <dt>Необхідний напір (підбір)</dt>
          <dd>
            {proposal.headRequiredM.toFixed(2)} <span className={styles.unit}>м</span>
          </dd>
          {proposal.estimatedTotalPrice > 0 && (
            <>
              <dt>Орієнтовна вартість (труби + насос)</dt>
              <dd className={styles.valueStrong}>
                {formatPriceUah(proposal.estimatedTotalPrice)}{' '}
                <span className={styles.unit}>грн</span>
              </dd>
            </>
          )}
        </dl>
      )}

      {!proposal.hasPipeSelection && proposal.unavailableReason != null && (
        <p className={styles.emptyHint}>{proposal.unavailableReason}</p>
      )}

      {proposal.pumpUnavailableReason != null && pumpsForHydraulics.length === 0 && (
        <p className={styles.hint}>{proposal.pumpUnavailableReason}</p>
      )}

      {pumpsForHydraulics.length > 0 && (
        <div className={styles.pumpsList}>
          {pumpsForHydraulics.map((p) => (
            <HydraulicsPumpCard key={p.zoneId} pump={p} />
          ))}
        </div>
      )}

      {proposal.pipeLineGroups.length > 0
        ? proposal.pipeLineGroups.map((group: ParsedHydraulicsPipeLineGroup) => (
            <PipeLinesTable
              key={group.circuitId}
              title={`Труби — ${group.label}`}
              pipeLines={group.pipeLines}
              footerPrice={group.estimatedPrice}
            />
          ))
        : (
          <PipeLinesTable
            title="Труби (зведення за позиціями каталогу)"
            pipeLines={proposal.pipeLines}
            {...(proposal.estimatedPipesPrice > 0
              ? { footerPrice: proposal.estimatedPipesPrice }
              : {})}
          />
        )}

      {proposal.hasPipeSelection
        && proposal.estimatedPipesPrice > 0
        && proposal.pipeLineGroups.length > 1 && (
        <p className={styles.tableFooter}>
          Разом за трубами: <strong>{formatPriceUah(proposal.estimatedPipesPrice)} грн</strong>
        </p>
      )}

      {proposal.pipeSegments.length > 0 && (
        <details className={styles.details}>
          <summary>Деталізація за ділянками ({proposal.pipeSegments.length})</summary>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Ділянка</th>
                <th>Тип</th>
                <th>Довжина</th>
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
                    seg.velocityLimitExceeded
                    || seg.catalogPoolExhausted
                    || (seg.velocityBelowMin === true && seg.mainTransitGuardApplied !== true)
                      ? styles.segmentRowWarning
                      : undefined
                  }
                >
                  <td>
                    {seg.segmentLabel}
                    {seg.groupedRoomIds != null && seg.groupedRoomIds.length > 0 ? (
                      <span className={styles.hintInline}>
                        {' '}
                        (колектор: {seg.groupedRoomIds.join(', ')})
                      </span>
                    ) : null}
                  </td>
                  <td>{segmentRoleLabel(seg.segmentRole, seg.isMainLine)}</td>
                  <td>
                    {seg.lengthM.toFixed(1)} <span className={styles.unit}>м</span>
                  </td>
                  <td>{formatBrandModel(seg.brand, seg.model)}</td>
                  <td>
                    {seg.velocityMps.toFixed(2)} <span className={styles.unit}>м/с</span>
                    {seg.velocityLimitExceeded === true ? (
                      <span className={styles.hintInline}> (вище норми)</span>
                    ) : null}
                    {seg.velocityBelowMin === true ? (
                      <span className={styles.hintInline}>
                        {seg.mainTransitGuardApplied === true
                          ? ' (нижче норми v, guard Dвн)'
                          : ' (нижче норми)'}
                      </span>
                    ) : null}
                    {seg.catalogPoolExhausted === true ? (
                      <span className={styles.hintInline}> (немає Ø у каталозі)</span>
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

/**
 * @param props
 */
export function HydraulicsReportView({
  hydraulics,
  catalogSource = null,
}: HydraulicsReportViewProps) {
  const proposal = hydraulics.proposal;
  const calculations = hydraulics.calculations;
  const flowContext = hydraulics.flowContext;
  const matchingWarnings = hydraulics.matchingWarnings;

  const allWarnings = [
    ...matchingWarnings,
    ...(calculations?.notes ?? []),
  ];

  return (
    <div>
      <p className={styles.hint}>
        Джерело: розрахунок API (Pure Pipeline) · підбір труб і насоса з каталогу.
        У блоці «Рекомендація» — компактна таблиця труб без цін; тут — повний розрахунок
        з цінами та деталізацією за ділянками.
      </p>

      {flowContext != null && <FlowContextBlock flowContext={flowContext} />}

      {calculations != null && (
        <CalculationsSummary calculations={calculations} proposal={proposal} />
      )}

      {proposal != null ? (
        <ProposalContent
          proposal={proposal}
          catalogSource={catalogSource}
        />
      ) : (
        calculations != null && (
          <p className={styles.hint}>
            Підбір позицій каталогу не сформовано — див. попередження нижче або перевірте каталог
            труб/насосів.
          </p>
        )
      )}

      {allWarnings.length > 0 && (
        <>
          <h4 className={styles.sectionTitle}>Попередження</h4>
          <ul className={styles.warningsList}>
            {allWarnings.map((w, i) => (
              <li key={`hyd-mw-${i}-${w.slice(0, 64)}`}>{w}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
