/**
 * Назначение: Таблица подбора радиаторов по комнатам.
 * Описание: Секции / панели для линии Economy или Efficient с явным типом прибора.
 */

import styles from './RadiatorProposalLineTable.module.css';
import {
  formatRadiatorRoomQuantityLabel,
  formatRadiatorsEmittersSummaryLabel,
  type RadiatorsProposalLineView,
} from '../../utils/parseRadiatorsMatchingFromReport';

type RadiatorProposalLineTableProps = {
  line: RadiatorsProposalLineView | null;
  caption: string;
  tableId: string;
};

/** Таблиця секцій / панелей радіаторів по приміщеннях. */
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
  const emittersLabel = formatRadiatorsEmittersSummaryLabel(line.emittersSummary);

  return (
    <div className={styles.wrap}>
      <p className={styles.caption} id={`${tableId}-caption`}>
        {caption}
        {graphLabel != null ? ` · графік ${graphLabel}` : ''}
        {emittersLabel != null ? ` · ${emittersLabel}` : ''}
      </p>
      {line.byRoom.length > 0 ? (
        <table
          className={styles.table}
          aria-labelledby={`${tableId}-caption`}
        >
          <thead>
            <tr>
              <th scope="col">Приміщення</th>
              <th scope="col">Прилад</th>
              <th scope="col">Кількість</th>
              <th scope="col">Віддача, Вт</th>
            </tr>
          </thead>
          <tbody>
            {line.byRoom.map((row) => {
              const qty = formatRadiatorRoomQuantityLabel(row);
              const model =
                row.radiatorModel && row.radiatorModel !== '—'
                  ? row.radiatorModel
                  : '—';
              const deliverable =
                row.deliverableWatts != null && row.deliverableWatts > 0
                  ? String(Math.round(row.deliverableWatts))
                  : '—';
              return (
                <tr
                  key={row.roomId || row.roomName}
                  className={
                    row.equipmentKindChangedVsEconomy
                      ? styles.kindChanged
                      : undefined
                  }
                  title={
                    row.equipmentKindChangedVsEconomy
                      ? 'Тип приладу відрізняється від варіанта «Економ»'
                      : undefined
                  }
                >
                  <td>
                    {row.roomName}
                    {row.equipmentKindChangedVsEconomy ? (
                      <span className={styles.kindChangedMark} aria-label="Тип приладу відрізняється від варіанта Економ">
                        {' '}
                        ≠економ
                      </span>
                    ) : null}
                  </td>
                  <td>{model}</td>
                  <td>{qty}</td>
                  <td>{deliverable}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className={styles.unavailable}>Немає даних за приміщеннями.</p>
      )}
    </div>
  );
}
