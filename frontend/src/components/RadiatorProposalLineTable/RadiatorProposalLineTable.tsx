/**
 * Назначение: Таблица подбора радиаторов по комнатам.
 * Описание: Секции и модели для линии Economy или Efficient с unavailableReason.
 */

import styles from './RadiatorProposalLineTable.module.css';
import type { RadiatorsProposalLineView } from '../../utils/parseRadiatorsMatchingFromReport';

type RadiatorProposalLineTableProps = {
  line: RadiatorsProposalLineView | null;
  caption: string;
  tableId: string;
};

/** Таблиця секцій радіаторів по приміщеннях для лінії «Економ» або «Ефективний». */
export function RadiatorProposalLineTable({
  line,
  caption,
  tableId,
}: RadiatorProposalLineTableProps) {
  if (line == null) {
    return null;
  }

  if (line.unavailableReason) {
    return (
      <p className={styles.unavailable} role="status">
        {line.unavailableReason}
      </p>
    );
  }

  const graphLabel =
    line.supplyC != null && line.returnC != null
      ? `${line.supplyC}/${line.returnC} °C`
      : null;

  return (
    <div className={styles.wrap}>
      <p className={styles.caption} id={`${tableId}-caption`}>
        {caption}
        {graphLabel != null ? ` · график ${graphLabel}` : ''}
        {line.totalSections != null ? ` · всего ${line.totalSections} сек.` : ''}
      </p>
      {line.byRoom.length > 0 ? (
        <table
          className={styles.table}
          aria-labelledby={`${tableId}-caption`}
        >
          <thead>
            <tr>
              <th scope="col">Помещение</th>
              <th scope="col">Секций</th>
            </tr>
          </thead>
          <tbody>
            {line.byRoom.map((row) => (
              <tr key={row.roomId || row.roomName}>
                <td>{row.roomName}</td>
                <td>{row.sections ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.unavailable}>Нет данных по помещениям.</p>
      )}
    </div>
  );
}
