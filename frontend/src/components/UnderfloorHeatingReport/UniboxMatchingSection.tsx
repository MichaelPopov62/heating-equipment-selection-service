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
    <div className={styles.wrap} style={{ marginTop: 12 }}>
      <h3 className={styles.title}>Унибоксы (подбор по петлям ТП)</h3>
      <p className={styles.meta}>
        Локальный регулятор петли: фильтр по паспортным лимитам (площадь, длина, T, P, Kv, eurocone).
        До 3 петель с унибоксом — без предупреждения; от 4 — пересмотр гидравлики. Каскад коллекторов не блокирует подбор.
      </p>

      {warnings.length > 0 && (
        <ul className={styles.meta} style={{ color: 'var(--danger, #b00020)' }}>
          {warnings.map((w, i) => (
            <li key={`unibox-warn-${i}`}>{w}</li>
          ))}
        </ul>
      )}

      {byLoop.length === 0 ? (
        <p className={styles.meta}>Нет строк подбора (гейт или нет петель с длиной &gt; 0).</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Петля</th>
                <th>Площадь / длина</th>
                <th>T под/обр / воздух</th>
                <th>Модель</th>
                <th>Тип</th>
                <th>Подключение</th>
                <th>Kv</th>
                <th>Цена</th>
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
