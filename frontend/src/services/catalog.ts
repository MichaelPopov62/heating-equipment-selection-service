/**
 * Назначение: Сервис каталога оборудования.
 * Описание: Загрузка снимка каталога с GET /api/v1/catalog для справочника в UI и будущего подбора в смете.
 */

import { parseCatalogBoilers } from './parseCatalogBoilers';
import {
  parseCatalogBoilerManifolds,
  parseCatalogManifolds,
} from './parseCatalogManifolds';
import { parseCatalogIndirectWaterHeaters } from './parseCatalogIndirectWaterHeaters';
import { parseCatalogUniboxes } from './parseCatalogUniboxes';
import { parseCatalogWaterHeaters } from './parseCatalogWaterHeaters';
import type {
  CatalogBoilerItem,
  CatalogBoilerManifoldItem,
  CatalogIndirectWaterHeaterItem,
  CatalogManifoldItem,
  CatalogUniboxItem,
  CatalogWaterHeaterItem,
} from './catalogTypes';

export type {
  CatalogBoilerCircuitPool,
  CatalogBoilerItem,
  CatalogBoilerManifoldItem,
  CatalogIndirectWaterHeaterItem,
  CatalogIndirectWaterHeaterType,
  CatalogManifoldDimensions,
  CatalogManifoldItem,
  CatalogUniboxItem,
  CatalogWaterHeaterItem,
  CatalogWaterHeaterVariant,
  ManifoldApplication,
  UniboxType,
} from './catalogTypes';

/** Типичная подсказка при недоступном upstream в dev (см. frontend/vite.config.ts). */
const CATALOG_BACKEND_HINT =
  'Запустите API-сервер из каталога backend (npm run start). В режиме разработки Vite проксирует запросы /api на http://localhost:3001 — пока backend не слушает этот порт, браузер может получить ошибку шлюза (502).';

export type CatalogEquipmentSnapshot = {
  catalogSource: 'file' | 'mongo';
  /** Всего котлов в обоих списках (двухконтурные + одноконтурные). */
  boilersTotal: number;
  /** Котлы (doubleCircuit + singleCircuit). */
  boilers: CatalogBoilerItem[];
  radiators: Record<string, unknown>[];
  /** Электронакопители (ЭВН). */
  waterHeaters: CatalogWaterHeaterItem[];
  /** Бойлеры косвенного нагрева (БКН). */
  indirectWaterHeaters: CatalogIndirectWaterHeaterItem[];
  pipes: Record<string, unknown>[];
  /** Коллекторы ТП / радиаторов — номенклатура для подбора и сметы. */
  manifolds: CatalogManifoldItem[];
  /** Котельные распределительные коллекторы. */
  boilerManifolds: CatalogBoilerManifoldItem[];
  /** Унибоксы — локальные регуляторы петли ТП. */
  uniboxes: CatalogUniboxItem[];
};

function catalogFailureMessage(status: number, raw: unknown): string {
  if (
    raw
    && typeof raw === 'object'
    && 'error' in raw
    && typeof (raw as { error?: { message?: unknown } }).error?.message === 'string'
  ) {
    const m = (raw as { error: { message: string } }).error.message.trim();
    if (m) return m;
  }
  if (status === 502 || status === 503 || status === 504) {
    return `Шлюз получил недопустимый ответ при запросе каталога (HTTP ${status}). ${CATALOG_BACKEND_HINT}`;
  }
  return `Не удалось загрузить каталог (HTTP ${status}). ${CATALOG_BACKEND_HINT}`;
}

/**
 * Загружает GET /api/v1/catalog и возвращает сводку для отображения.
 */
export function fetchCatalogEquipment(): Promise<CatalogEquipmentSnapshot> {
  return loadCatalogEquipmentFromApi();
}

/**
 * @returns {Promise<CatalogEquipmentSnapshot>}
 */
async function loadCatalogEquipmentFromApi(): Promise<CatalogEquipmentSnapshot> {
  let res: Response;
  try {
    res = await fetch('/api/v1/catalog', {
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new Error(
      `Запрос каталога не дошёл до сервера (сеть или CORS). ${CATALOG_BACKEND_HINT}`,
    );
  }
  const raw: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(catalogFailureMessage(res.status, raw));
  }
  if (!raw || typeof raw !== 'object' || (raw as { ok?: unknown }).ok !== true) {
    throw new Error('Некорректный ответ API каталога');
  }
  const data = raw as {
    catalog?: unknown;
    catalogSource?: unknown;
  };
  const cat = data.catalog && typeof data.catalog === 'object' ? (data.catalog as Record<string, unknown>) : {};
  const boilers = parseCatalogBoilers(cat.boilers);
  const src = data.catalogSource;
  const catalogSource: 'file' | 'mongo' = src === 'mongo' ? 'mongo' : 'file';

  return {
    catalogSource,
    boilersTotal: boilers.length,
    boilers,
    radiators: Array.isArray(cat.radiators) ? (cat.radiators as Record<string, unknown>[]) : [],
    waterHeaters: parseCatalogWaterHeaters(cat.waterHeaters),
    indirectWaterHeaters: parseCatalogIndirectWaterHeaters(cat.indirectWaterHeaters),
    pipes: Array.isArray(cat.pipes) ? (cat.pipes as Record<string, unknown>[]) : [],
    manifolds: parseCatalogManifolds(cat.manifolds),
    boilerManifolds: parseCatalogBoilerManifolds(cat.boilerManifolds),
    uniboxes: parseCatalogUniboxes(cat.uniboxes),
  };
}
