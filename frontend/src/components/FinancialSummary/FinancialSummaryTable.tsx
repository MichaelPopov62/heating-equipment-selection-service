/**
 * Назначение: таблица «Итог финансовый» (report.commercial).
 * Описание: иерархия scope/category, суффикс единиц в колонке количества, итоговые строки.
 */

import type { ParsedCommercialBom, ParsedFinancialBomLine } from '../../utils/parsers/parseCommercialBomFromReport';
import styles from './FinancialSummaryTable.module.css';

export type FinancialSummaryTableProps = {
  commercial: ParsedCommercialBom | null;
  calcLoading?: boolean;
  reportIsStale?: boolean;
};

/**
 * @param n
 */
function formatMoney(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('uk-UA');
}

/**
 * @param qty
 */
function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return '—';
  if (Number.isInteger(qty)) return String(qty);
  return qty.toLocaleString('uk-UA', { maximumFractionDigits: 2 });
}

/**
 * @param unit
 */
function qtyUnitLabel(unit: ParsedFinancialBomLine['qtyUnit']): string {
  switch (unit) {
    case 'pcs':
      return 'шт';
    case 'm':
      return 'м';
    case 'section':
      return 'сек.';
    case 'lot':
      return 'компл.';
    default:
      return '';
  }
}

/**
 * @param objectType
 */
function objectTypeLabel(objectType: 'house' | 'apartment'): string {
  return objectType === 'apartment' ? 'Квартира' : 'Будинок';
}

/**
 * @param brand
 * @param model
 */
function brandModelLabel(brand: string, model: string): string {
  if (brand && model) return `${brand} ${model}`;
  return model || brand || '—';
}

type RenderRow =
  | { type: 'group'; key: string; label: string }
  | { type: 'category'; key: string; label: string }
  | { type: 'line'; key: string; line: ParsedFinancialBomLine };

/**
 * Строит плоский список строк таблицы с заголовками групп.
 *
 * @param lines
 */
function buildRenderRows(lines: ParsedFinancialBomLine[]): RenderRow[] {
  const equipmentAndNotes = lines.filter(
    (l) => l.kind === 'equipment' || l.kind === 'note',
  );
  const works = lines.filter(
    (l) => l.kind === 'labor' || l.kind === 'consumable',
  );

  /** @type {RenderRow[]} */
  const rows: RenderRow[] = [];
  let prevScope0 = '';
  let prevCategory = '';

  for (const line of equipmentAndNotes) {
    const scope0 = line.scopePath[0] ?? objectTypeLabel(line.objectType);
    const categoryLabel = line.scopePath[1] ?? line.equipmentTypeLabel;
    if (scope0 !== prevScope0) {
      rows.push({ type: 'group', key: `g:${scope0}`, label: scope0 });
      prevScope0 = scope0;
      prevCategory = '';
    }
    if (categoryLabel !== prevCategory) {
      rows.push({
        type: 'category',
        key: `c:${scope0}:${categoryLabel}`,
        label: categoryLabel,
      });
      prevCategory = categoryLabel;
    }
    rows.push({ type: 'line', key: line.id, line });
  }

  if (works.length > 0) {
    rows.push({ type: 'group', key: 'g:works', label: 'Роботи' });
    for (const line of works) {
      rows.push({ type: 'line', key: line.id, line });
    }
  }

  return rows;
}

/**
 * @param props
 */
export function FinancialSummaryTable({
  commercial,
  calcLoading = false,
  reportIsStale = false,
}: FinancialSummaryTableProps) {
  const showRecalculating = calcLoading || reportIsStale;

  if (commercial == null) {
    return (
      <div className={styles.wrap} aria-labelledby="financial-summary-title">
        <h3 id="financial-summary-title" className={styles.title}>
          Підсумок фінансовий
        </h3>
        {showRecalculating ? (
          <p className={styles.stale} role="status">
            Триває перерахунок…
          </p>
        ) : null}
        <p className={styles.empty} role="status">
          Немає актуальної кошторису. Заповніть анкету та дочекайтеся розрахунку.
        </p>
      </div>
    );
  }

  const renderRows = buildRenderRows(commercial.lines);
  const { totals, rates } = commercial;

  return (
    <div className={styles.wrap} aria-labelledby="financial-summary-title">
      <h3 id="financial-summary-title" className={styles.title}>
        Підсумок фінансовий
      </h3>
      {showRecalculating ? (
        <p className={styles.stale} role="status">
          Триває перерахунок — суми можуть оновитися…
        </p>
      ) : null}
      <p className={styles.meta}>
        Валюта: {commercial.currency}. Монтаж {rates.laborPercentOfEquipment}% і
        витратні матеріали {rates.consumablesPercentOfEquipment}% від вартості
        обладнання.
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Тип об&apos;єкта</th>
              <th>Тип обладнання</th>
              <th>Марка (модель)</th>
              <th>Кількість</th>
              <th>Ціна, грн</th>
              <th>Сума, грн</th>
            </tr>
          </thead>
          <tbody>
            {renderRows.map((row) => {
              if (row.type === 'group') {
                return (
                  <tr key={row.key} className={styles.groupRow}>
                    <td colSpan={6}>{row.label}</td>
                  </tr>
                );
              }
              if (row.type === 'category') {
                return (
                  <tr key={row.key} className={styles.categoryRow}>
                    <td colSpan={6}>{row.label}</td>
                  </tr>
                );
              }
              const { line } = row;
              return (
                <tr key={row.key}>
                  <td>{objectTypeLabel(line.objectType)}</td>
                  <td>{line.equipmentTypeLabel}</td>
                  <td>{brandModelLabel(line.brand, line.model)}</td>
                  <td className={styles.num}>
                    {formatQty(line.qty)}
                    <span className={styles.unit}>{qtyUnitLabel(line.qtyUnit)}</span>
                  </td>
                  <td className={styles.num}>{formatMoney(line.unitPriceUah)}</td>
                  <td className={styles.num}>{formatMoney(line.lineTotalUah)}</td>
                </tr>
              );
            })}
            <tr className={styles.totalsRow}>
              <td colSpan={3}>Разом за обладнанням</td>
              <td className={styles.num}>
                {formatQty(totals.equipmentQtyPcs)}
                <span className={styles.unit}>шт</span>
              </td>
              <td className={styles.num}>—</td>
              <td className={styles.num}>{formatMoney(totals.equipmentTotalUah)}</td>
            </tr>
            <tr className={styles.totalsRow}>
              <td colSpan={5}>
                Монтажні роботи ({rates.laborPercentOfEquipment}%)
              </td>
              <td className={styles.num}>{formatMoney(totals.laborTotalUah)}</td>
            </tr>
            <tr className={styles.totalsRow}>
              <td colSpan={5}>
                Витратні матеріали ({rates.consumablesPercentOfEquipment}%)
              </td>
              <td className={styles.num}>
                {formatMoney(totals.consumablesTotalUah)}
              </td>
            </tr>
            <tr className={styles.grandRow}>
              <td colSpan={5}>Загальна вартість об&apos;єкта</td>
              <td className={styles.num}>{formatMoney(totals.grandTotalUah)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
