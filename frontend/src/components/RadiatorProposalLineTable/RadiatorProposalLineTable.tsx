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
        {graphLabel != null ? ` · график ${graphLabel}` : ''}
        {emittersLabel != null ? ` · ${emittersLabel}` : ''}
      </p>
      {line.byRoom.length > 0 ? (
        <table
          className={styles.table}
          aria-labelledby={`${tableId}-caption`}
        >
          <thead>
            <tr>
              <th scope="col">Помещение</th>
              <th scope="col">Прибор</th>
              <th scope="col">Кол-во</th>
              <th scope="col">Отдача, Вт</th>
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
                      ? 'Тип прибора отличается от варианта «Эконом»'
                      : undefined
                  }
                >
                  <td>
                    {row.roomName}
                    {row.equipmentKindChangedVsEconomy ? (
                      <span className={styles.kindChangedMark} aria-label="Тип прибора отличается от варианта Эконом">
                        {' '}
                        ≠эконом
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
        <p className={styles.unavailable}>Нет данных по помещениям.</p>
      )}
    </div>
  );
}
