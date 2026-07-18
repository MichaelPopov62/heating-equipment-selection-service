/**
 * Призначення: компактна таблиця підбору труб у блоці «Рекомендация».
 * Опис: Позиції каталогу без цін і без деталізації по контурах/ділянках.
 */

import type { ParsedHydraulicsPipeLine, ParsedHydraulicsView } from '../../types/hydraulics';
import { formatBrandModel } from '../../utils/format';
import { hasHydraulicsReportContent } from './hasHydraulicsReportContent';
import styles from './HydraulicsProposalTable.module.css';

export type HydraulicsProposalTableProps = {
  hydraulics: ParsedHydraulicsView | null;
};

/**
 * Плоский список позицій труб (без групування по контурах).
 *
 * @param proposal
 */
function resolveFlatPipeLines(
  proposal: NonNullable<ParsedHydraulicsView['proposal']>,
): ParsedHydraulicsPipeLine[] {
  if (proposal.pipeLines.length > 0) {
    return proposal.pipeLines;
  }
  return proposal.pipeLineGroups.flatMap((g) => g.pipeLines);
}

/**
 * @param props
 */
export function HydraulicsProposalTable({
  hydraulics,
}: HydraulicsProposalTableProps) {
  if (!hasHydraulicsReportContent(hydraulics) || hydraulics == null) {
    return null;
  }

  const proposal = hydraulics.proposal;
  if (proposal == null) {
    return null;
  }

  if (!proposal.hasPipeSelection) {
    return (
      <div
        className={styles.wrap}
        aria-labelledby="hydraulics-proposal-table-title"
      >
        <h4 id="hydraulics-proposal-table-title" className={styles.title}>
          Гидравлика · трубы
        </h4>
        <p className={styles.empty} role="status">
          {proposal.unavailableReason
            ?? 'Нет подходящих позиций труб в каталоге. Полный расчёт — на шаге «Гидравлика».'}
        </p>
      </div>
    );
  }

  const pipeLines = resolveFlatPipeLines(proposal);
  if (pipeLines.length === 0) {
    return null;
  }

  return (
    <div
      className={styles.wrap}
      aria-labelledby="hydraulics-proposal-table-title"
    >
      <h4 id="hydraulics-proposal-table-title" className={styles.title}>
        Гидравлика · трубы
      </h4>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Модель</th>
              <th>Материал</th>
              <th>Ø внутр.</th>
              <th>Длина</th>
            </tr>
          </thead>
          <tbody>
            {pipeLines.map((line) => (
              <tr key={line.catalogPipeId}>
                <td>{formatBrandModel(line.brand, line.model)}</td>
                <td>{line.material.length > 0 ? line.material : '—'}</td>
                <td>{line.internalDiameterMm.toFixed(1)} мм</td>
                <td>{line.totalLengthM.toFixed(1)} м</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
