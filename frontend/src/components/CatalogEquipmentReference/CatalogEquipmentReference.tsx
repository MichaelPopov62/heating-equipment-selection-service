/**
 * Назначение: Справочник каталога оборудования.
 * Описание: Счётчики номенклатуры, радиаторы, трубы и коллекторы из GET /api/v1/catalog.
 */

import type {
  CatalogBoilerManifoldItem,
  CatalogEquipmentSnapshot,
  CatalogManifoldItem,
} from '../../services/catalog';
import { formatCatalogDimensionsMm } from '../../utils/formatCatalogDimensions';
import { manifoldApplicationLabel } from '../../utils/manifoldApplicationLabel';
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
  if (typeof v === 'string') {
    const s = v.trim();
    return s || '—';
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return '—';
}

function formatPriceUah(price: number): string {
  if (!Number.isFinite(price)) return '—';
  return `${Math.round(price).toLocaleString('uk-UA')} ₴`;
}

function formatBool(value: boolean): string {
  return value ? 'да' : 'нет';
}

/**
 * Справочник позиций каталога API: счётчики, радиаторы, трубы, коллекторы.
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

  const {
    catalogSource,
    boilersTotal,
    radiators,
    waterHeaters,
    pipes,
    manifolds,
    boilerManifolds,
    uniboxes,
  } = snapshot;
  const srcLabel =
    catalogSource === 'mongo'
      ? 'MongoDB (+ недостающие позиции из файла при слиянии)'
      : 'файл test_data.json';

  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>Справочник каталога</h3>
      <p className={styles.meta}>
        Источник: <strong>{srcLabel}</strong>. Полный перечень используется сервером для подбора;
        коллекторы — номенклатура для будущего автоподбора и строк сметы.
      </p>
      <ul className={styles.counts}>
        <li className={styles.countItem}>
          <span className={styles.countLabel}>Котлы</span>
          <span className={styles.countValue}>{boilersTotal}</span>
        </li>
        <li className={styles.countItem}>
          <span className={styles.countLabel}>Радиаторы</span>
          <span className={styles.countValue}>{radiators.length}</span>
        </li>
        <li className={styles.countItem}>
          <span className={styles.countLabel}>Водонагреватели</span>
          <span className={styles.countValue}>{waterHeaters.length}</span>
        </li>
        <li className={styles.countItem}>
          <span className={styles.countLabel}>Трубы</span>
          <span className={styles.countValue}>{pipes.length}</span>
        </li>
        <li className={styles.countItem}>
          <span className={styles.countLabel}>Коллекторы</span>
          <span className={styles.countValue}>{manifolds.length}</span>
        </li>
        <li className={styles.countItem}>
          <span className={styles.countLabel}>Котельные коллекторы</span>
          <span className={styles.countValue}>{boilerManifolds.length}</span>
        </li>
        <li className={styles.countItem}>
          <span className={styles.countLabel}>Унибоксы</span>
          <span className={styles.countValue}>{uniboxes.length}</span>
        </li>
      </ul>

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

      <details className={styles.block} open={manifolds.length > 0 && manifolds.length <= 8}>
        <summary>
          Коллекторы ТП / радиаторов ({manifolds.length}) — для подбора и сметы
        </summary>
        {manifolds.length === 0 ? (
          <p className={styles.meta}>В каталоге нет коллекторов.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Бренд</th>
                  <th>Артикул</th>
                  <th>Выходы</th>
                  <th>Назначение</th>
                  <th>Расходомеры</th>
                  <th>Подключение</th>
                  <th>Габариты</th>
                  <th>Цена</th>
                </tr>
              </thead>
              <tbody>
                {manifolds.map((m: CatalogManifoldItem) => (
                  <tr key={`manifold-${m.article}`}>
                    <td>{m.brand}</td>
                    <td>{m.article}</td>
                    <td>{m.outletsCount}</td>
                    <td>{manifoldApplicationLabel(m.manifoldApplication)}</td>
                    <td>{formatBool(m.hasFlowMeters)}</td>
                    <td>
                      {m.connectionMainInch}&quot; → {m.connectionOutletsInch}&quot;
                    </td>
                    <td>{formatCatalogDimensionsMm(m.dimensions)}</td>
                    <td>{formatPriceUah(m.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>

      <details className={styles.block} open={boilerManifolds.length > 0}>
        <summary>
          Котельные коллекторы ({boilerManifolds.length}) — для подбора и сметы
        </summary>
        {boilerManifolds.length === 0 ? (
          <p className={styles.meta}>В каталоге нет котельных коллекторов.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Бренд</th>
                  <th>Артикул</th>
                  <th>Контуры</th>
                  <th>Макс. кВт</th>
                  <th>Изоляция</th>
                  <th>Подключение</th>
                  <th>Габариты</th>
                  <th>Цена</th>
                </tr>
              </thead>
              <tbody>
                {boilerManifolds.map((m: CatalogBoilerManifoldItem) => (
                  <tr key={`boiler-manifold-${m.article}`}>
                    <td>{m.brand}</td>
                    <td>{m.article}</td>
                    <td>{m.circuitsCount}</td>
                    <td>{m.maxPowerKw}</td>
                    <td>{formatBool(m.hasInsulation)}</td>
                    <td>
                      {m.connectionBoilerInch}&quot; / {m.connectionCircuitsInch}&quot;
                    </td>
                    <td>{formatCatalogDimensionsMm(m.dimensions)}</td>
                    <td>{formatPriceUah(m.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>

      <details className={styles.block} open={uniboxes.length > 0 && uniboxes.length <= 12}>
        <summary>
          Унибоксы ({uniboxes.length}) — локальные регуляторы петли ТП
        </summary>
        {uniboxes.length === 0 ? (
          <p className={styles.meta}>В каталоге нет унибоксов.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Бренд</th>
                  <th>Модель</th>
                  <th>Тип</th>
                  <th>Площадь</th>
                  <th>Петля</th>
                  <th>Подключение</th>
                  <th>Kv</th>
                  <th>Цена</th>
                </tr>
              </thead>
              <tbody>
                {uniboxes.map((u) => (
                  <tr key={`unibox-${u.id}`}>
                    <td>{u.id}</td>
                    <td>{u.brand}</td>
                    <td>{u.model}</td>
                    <td>{u.type}</td>
                    <td>{u.maxAreaSqM} м²</td>
                    <td>{u.maxLoopLengthM} м</td>
                    <td>
                      {u.connection.thread} / {u.connection.fit}
                    </td>
                    <td>{u.kvM3h}</td>
                    <td>{formatPriceUah(u.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
