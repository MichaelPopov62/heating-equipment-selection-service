/**
 * Назначение: Справочник каталога оборудования.
 * Описание: Счётчики номенклатуры, радиаторы и таблица труб из GET /api/v1/catalog.
 */

import type { CatalogEquipmentSnapshot } from '../../services/catalog';
import styles from './CatalogEquipmentReference.module.css';

function str(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  return '';
}

function pipeCell(p: Record<string, unknown>, key: string): string {
  const v = p[key];
  if (v == null || v === '') return '—';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '—';
  const s = String(v).trim();
  return s || '—';
}

/**
 * Справочник позиций каталога API: счётчики, список радиаторов (тип/конструкция), таблица труб.
 */
export function CatalogEquipmentReference({
  snapshot,
  loading,
  error,
  onRetry,
}: {
  snapshot: CatalogEquipmentSnapshot | null;
  loading: boolean;
  error: string | null;
  /** Повторная загрузка после ошибки (например backend был выключен). */
  onRetry?: () => void;
}) {
  if (loading && !snapshot) {
    return (
      <div className={styles.wrap} aria-live="polite">
        <h3 className={styles.title}>Справочник каталога</h3>
        <p className={styles.meta}>Загрузка…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.wrap}>
        <h3 className={styles.title}>Справочник каталога</h3>
        <p className={styles.err}>{error}</p>
        {onRetry != null ? (
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() => {
              onRetry();
            }}
            disabled={loading}
          >
            {loading ? 'Загрузка…' : 'Повторить загрузку'}
          </button>
        ) : null}
      </div>
    );
  }

  if (!snapshot) return null;

  const { catalogSource, boilersTotal, radiators, waterHeaters, pipes } = snapshot;
  const srcLabel =
    catalogSource === 'mongo'
      ? 'MongoDB (+ недостающие позиции из файла при слиянии)'
      : 'файл test_data.json';

  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>Справочник каталога</h3>
      <p className={styles.meta}>
        Источник: <strong>{srcLabel}</strong>. Полный перечень используется сервером для подбора.
      </p>
      <dl className={styles.counts}>
        <dt>Котлы</dt>
        <dd>{boilersTotal}</dd>
        <dt>Радиаторы</dt>
        <dd>{radiators.length}</dd>
        <dt>Водонагреватели</dt>
        <dd>{waterHeaters.length}</dd>
        <dt>Трубы</dt>
        <dd>{pipes.length}</dd>
      </dl>

      <details className={styles.block} open={radiators.length > 0 && radiators.length <= 12}>
        <summary>
          Радиаторы ({radiators.length}) — модели и роль в каталоге
        </summary>
        <ul className={styles.radiatorList}>
          {radiators.map((r, i) => {
            const model = str(r.model) || '—';
            const brand = str(r.brand);
            const type = str(r.type);
            const construction = str(r.construction);
            const article = str(r.article);
            const bits = [
              brand && `бренд: ${brand}`,
              type && `тип: ${type}`,
              construction && `конструкция: ${construction}`,
              article && `арт.: ${article}`,
            ].filter(Boolean);
            return (
              <li key={`rad-${i}-${model}`}>
                <strong>{model}</strong>
                {bits.length > 0 ? (
                  <>
                    {' '}
                    <span className={styles.muted}>({bits.join('; ')})</span>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      </details>

      <details className={styles.block} open={pipes.length > 0}>
        <summary>Трубы ({pipes.length})</summary>
        {pipes.length === 0 ? (
          <p className={styles.meta}>В каталоге нет позиций труб.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Бренд</th>
                  <th>Материал</th>
                  <th>Ø, мм</th>
                  <th>Стенка</th>
                  <th>Цена</th>
                  <th>Назначение</th>
                </tr>
              </thead>
              <tbody>
                {pipes.map((p, i) => (
                  <tr key={`pipe-row-${i}`}>
                    <td>{pipeCell(p, 'id')}</td>
                    <td>{pipeCell(p, 'brand')}</td>
                    <td>{pipeCell(p, 'material')}</td>
                    <td>{pipeCell(p, 'diameter')}</td>
                    <td>{pipeCell(p, 'wallThickness')}</td>
                    <td>{pipeCell(p, 'price')}</td>
                    <td>{pipeCell(p, 'category')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </div>
  );
}
