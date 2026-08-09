/**
 * Назначение: Таблица подбора унибоксов из matching.uniboxes.
 * Описание: Строки по петлям ТП — модель, лимиты, цена; warnings блока.
 */

import type { ParsedUniboxesMatching } from '../../utils/parseUniboxesMatchingFromReport';
import styles from '../CatalogEquipmentReference/CatalogEquipmentReference.module.css';

type Props = {
  matching: ParsedUniboxesMatching;
};

function formatPriceUah(price: number): string {
  return `${Math.round(price).toLocaleString('ru-RU')} ₴`;
}

/**
 * @param {Props} props
 */
export function UniboxMatchingSection({ matching }: Props) {
  const { byLoop, warnings } = matching;
  if (byLoop.length === 0 && warnings.length === 0) return null;

  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>Унибокси (підбір за петлями ТП)</h3>
      <p className={styles.meta}>
        Локальний регулятор петлі: фільтр за паспортними лімітами (площа, довжина, T, P, Kv, eurocone).
        До 3 петель з унибоксом — без попередження; від 4 — перегляд гідравліки. Каскад колекторів не блокує підбір.
      </p>

      {warnings.length > 0 && (
        <ul className={`${styles.meta} ${styles.metaDanger}`}>
          {warnings.map((w, i) => (
            <li key={`unibox-warn-${i}`}>{w}</li>
          ))}
        </ul>
      )}

      {byLoop.length === 0 ? (
        <p className={styles.meta}>Немає рядків підбору (гейт або немає петель з довжиною &gt; 0).</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Петля</th>
                <th>Площа / довжина</th>
                <th>T под/обр / повітря</th>
                <th>Модель</th>
                <th>Тип</th>
                <th>Підключення</th>
                <th>Kv</th>
                <th>Ціна</th>
              </tr>
            </thead>
            <tbody>
              {byLoop.map((row) => {
                const s = row.selected;
                return (
                  <tr key={`${row.roomId}-${row.loopId}`}>
                    <td>
                      {row.roomId} / {row.loopId}
                    </td>
                    <td>
                      {row.required.areaSqM} м² / {row.required.loopLengthM} м
                    </td>
                    <td>
                      {row.required.circuitSupplyC}/{row.required.circuitReturnC} /{' '}
                      {row.required.roomAirTempC} °C
                    </td>
                    <td>{s ? `${s.brand} ${s.model}` : '—'}</td>
                    <td>{s?.type ?? '—'}</td>
                    <td>
                      {s
                        ? `${s.connection.thread} / ${s.connection.fit}`
                        : row.required.requiredFit}
                    </td>
                    <td>{s ? s.kvM3h : `≥${row.required.minKvM3h.toFixed(3)}`}</td>
                    <td>{s ? formatPriceUah(s.price) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {byLoop.some((r) => r.warnings.length > 0) && (
        <ul className={styles.meta}>
          {byLoop.flatMap((r) =>
            r.warnings.map((w, i) => (
              <li key={`${r.loopId}-w-${i}`}>
                {r.loopId}: {w}
              </li>
            )),
          )}
        </ul>
      )}
    </div>
  );
}
