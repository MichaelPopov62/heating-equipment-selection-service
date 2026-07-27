/**
 * Назначение: Справочник каталога оборудования.
 * Описание: Счётчики и таблицы номенклатуры из GET /api/v1/catalog (котлы, ГВС, радиаторы, трубы…).
 */

import type {
  CatalogBoilerItem,
  CatalogBoilerManifoldItem,
  CatalogEquipmentSnapshot,
  CatalogIndirectWaterHeaterItem,
  CatalogIndirectWaterHeaterType,
  CatalogManifoldItem,
  CatalogWaterHeaterItem,
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
  return value ? 'так' : 'ні';
}

/**
 * @param pool
 */
function boilerCircuitLabel(pool: CatalogBoilerItem['circuitPool']): string {
  return pool === 'doubleCircuit' ? '2К' : '1К';
}

/**
 * @param mounting
 */
function boilerMountingLabel(mounting: CatalogBoilerItem['mountingType']): string {
  if (mounting === 'wall') return 'настінний';
  if (mounting === 'floor') return 'напольний';
  return '—';
}

/**
 * @param type
 */
function indirectTypeLabel(type: CatalogIndirectWaterHeaterType): string {
  if (type === 'indirect_wall') return 'настінний';
  if (type === 'indirect_floor') return 'напольний';
  return 'storage_indirect';
}

/**
 * @param item
 */
function waterHeaterVolumesLabel(item: CatalogWaterHeaterItem): string {
  return item.variants.map((v) => `${v.volumeLiters} л`).join(', ');
}

/**
 * @param item
 */
function waterHeaterPricesLabel(item: CatalogWaterHeaterItem): string {
  return item.variants.map((v) => formatPriceUah(v.price)).join('; ');
}

/**
 * Справочник позиций каталога API: счётчики и таблицы номенклатуры.
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
        <h3 className={styles.title}>Довідник каталогу</h3>
        <p className={styles.meta}>Завантаження…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.wrap}>
        <h3 className={styles.title}>Довідник каталогу</h3>
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
            {loading ? 'Завантаження…' : 'Повторити завантаження'}
          </button>
        ) : null}
      </div>
    );
  }

  if (!snapshot) return null;

  const {
    catalogSource,
    boilersTotal,
    boilers,
    radiators,
    waterHeaters,
    indirectWaterHeaters,
    pipes,
    manifolds,
    boilerManifolds,
    uniboxes,
  } = snapshot;
  const srcLabel =
    catalogSource === 'mongo'
      ? 'MongoDB (+ недостатні позиції з файлу при злитті)'
      : 'файл test_data.json';

  return (
    <div className={styles.wrap}>
      <h3 className={styles.title}>Довідник каталогу</h3>
      <p className={styles.meta}>
        Джерело: <strong>{srcLabel}</strong>. Повний перелік використовується сервером для підбору;
        колектори — номенклатура для майбутнього автопідбору та рядків кошторису.
      </p>
      <ul className={styles.counts}>
        <li className={styles.countItem}>
          <span className={styles.countLabel}>Котли</span>
          <span className={styles.countValue}>{boilersTotal}</span>
        </li>
        <li className={styles.countItem}>
          <span className={styles.countLabel}>Радіатори</span>
          <span className={styles.countValue}>{radiators.length}</span>
        </li>
        <li className={styles.countItem}>
          <span className={styles.countLabel}>ЕВН</span>
          <span className={styles.countValue}>{waterHeaters.length}</span>
        </li>
        <li className={styles.countItem}>
          <span className={styles.countLabel}>БКН</span>
          <span className={styles.countValue}>{indirectWaterHeaters.length}</span>
        </li>
        <li className={styles.countItem}>
          <span className={styles.countLabel}>Труби</span>
          <span className={styles.countValue}>{pipes.length}</span>
        </li>
        <li className={styles.countItem}>
          <span className={styles.countLabel}>Колектори</span>
          <span className={styles.countValue}>{manifolds.length}</span>
        </li>
        <li className={styles.countItem}>
          <span className={styles.countLabel}>Котельні колектори</span>
          <span className={styles.countValue}>{boilerManifolds.length}</span>
        </li>
        <li className={styles.countItem}>
          <span className={styles.countLabel}>Унибокси</span>
          <span className={styles.countValue}>{uniboxes.length}</span>
        </li>
      </ul>

      <details className={styles.block} open={boilers.length > 0 && boilers.length <= 16}>
        <summary>Котли ({boilers.length}) — 1К / 2К</summary>
        {boilers.length === 0 ? (
          <p className={styles.meta}>У каталозі немає котлів.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Бренд</th>
                  <th>Модель</th>
                  <th>Контур</th>
                  <th>Тип</th>
                  <th>Потужність, кВт</th>
                  <th>Монтаж</th>
                  <th>Артикул</th>
                  <th>Ціна</th>
                </tr>
              </thead>
              <tbody>
                {boilers.map((b: CatalogBoilerItem, i) => (
                  <tr key={`boiler-${b.circuitPool}-${b.model}-${i}`}>
                    <td>{b.brand || '—'}</td>
                    <td>{b.model}</td>
                    <td>{boilerCircuitLabel(b.circuitPool)}</td>
                    <td>{b.type}</td>
                    <td>
                      {b.powerKwMin}…{b.powerKwMax}
                    </td>
                    <td>{boilerMountingLabel(b.mountingType)}</td>
                    <td>{b.article || '—'}</td>
                    <td>{formatPriceUah(b.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>

      <details className={styles.block} open={radiators.length > 0 && radiators.length <= 12}>
        <summary>
          Радіатори ({radiators.length}) — моделі та роль у каталозі
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
              construction && `конструкція: ${construction}`,
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

      <details
        className={styles.block}
        open={waterHeaters.length > 0 && waterHeaters.length <= 12}
      >
        <summary>
          Водонагрівачі ЕВН ({waterHeaters.length}) — електронакопичувачі
        </summary>
        {waterHeaters.length === 0 ? (
          <p className={styles.meta}>У каталозі немає електронакопичувачів.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Бренд</th>
                  <th>Модель</th>
                  <th>Тип</th>
                  <th>Об&apos;єми</th>
                  <th>Ціни за варіантами</th>
                </tr>
              </thead>
              <tbody>
                {waterHeaters.map((w, i) => (
                  <tr key={`wh-${w.model}-${i}`}>
                    <td>{w.brand || '—'}</td>
                    <td>{w.model}</td>
                    <td>{w.type}</td>
                    <td>{waterHeaterVolumesLabel(w)}</td>
                    <td>{waterHeaterPricesLabel(w)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>

      <details
        className={styles.block}
        open={indirectWaterHeaters.length > 0 && indirectWaterHeaters.length <= 12}
      >
        <summary>
          БКН ({indirectWaterHeaters.length}) — бойлери непрямого нагріву
        </summary>
        {indirectWaterHeaters.length === 0 ? (
          <p className={styles.meta}>У каталозі немає бойлерів непрямого нагріву.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Бренд</th>
                  <th>Модель</th>
                  <th>Тип</th>
                  <th>Об&apos;єм, л</th>
                  <th>Змійовик, кВт</th>
                  <th>Мін. джерело, кВт</th>
                  <th>Артикул</th>
                  <th>Ціна</th>
                </tr>
              </thead>
              <tbody>
                {indirectWaterHeaters.map((t: CatalogIndirectWaterHeaterItem, i) => (
                  <tr key={`indirect-${t.model}-${t.article}-${i}`}>
                    <td>{t.brand || '—'}</td>
                    <td>{t.model}</td>
                    <td>{indirectTypeLabel(t.type)}</td>
                    <td>{t.volumeLiters}</td>
                    <td>{t.coilPowerKw != null ? t.coilPowerKw : '—'}</td>
                    <td>{t.minSourcePowerKw != null ? t.minSourcePowerKw : '—'}</td>
                    <td>{t.article || '—'}</td>
                    <td>{formatPriceUah(t.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>

      <details className={styles.block} open={manifolds.length > 0 && manifolds.length <= 8}>
        <summary>
          Колектори ТП / радіаторів ({manifolds.length}) — для підбору та кошторису
        </summary>
        {manifolds.length === 0 ? (
          <p className={styles.meta}>У каталозі немає колекторів.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Бренд</th>
                  <th>Артикул</th>
                  <th>Виходи</th>
                  <th>Призначення</th>
                  <th>Витратоміри</th>
                  <th>Підключення</th>
                  <th>Габарити</th>
                  <th>Ціна</th>
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
          Котельні колектори ({boilerManifolds.length}) — для підбору та кошторису
        </summary>
        {boilerManifolds.length === 0 ? (
          <p className={styles.meta}>У каталозі немає котельних колекторів.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Бренд</th>
                  <th>Артикул</th>
                  <th>Контури</th>
                  <th>Макс. кВт</th>
                  <th>Ізоляція</th>
                  <th>Підключення</th>
                  <th>Габарити</th>
                  <th>Ціна</th>
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
          Унибокси ({uniboxes.length}) — локальні регулятори петлі ТП
        </summary>
        {uniboxes.length === 0 ? (
          <p className={styles.meta}>У каталозі немає унибоксів.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Бренд</th>
                  <th>Модель</th>
                  <th>Тип</th>
                  <th>Площа</th>
                  <th>Петля</th>
                  <th>Підключення</th>
                  <th>Kv</th>
                  <th>Ціна</th>
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
        <summary>Труби ({pipes.length})</summary>
        {pipes.length === 0 ? (
          <p className={styles.meta}>У каталозі немає позицій труб.</p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Бренд</th>
                  <th>Матеріал</th>
                  <th>Ø, мм</th>
                  <th>Стінка</th>
                  <th>Ціна</th>
                  <th>Призначення</th>
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
