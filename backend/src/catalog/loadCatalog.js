/**
 * Назначение: загрузка каталога оборудования.
 * Описание: чтение номенклатуры из MongoDB (коллекция products) или локального JSON с режимами
 * mongo, file и auto; нормализация через validateAndNormalizeCatalog.
 */
import * as fs from 'node:fs/promises';
import { validateAndNormalizeCatalog } from './validateCatalog.js';
import { resolvePipeCatalogId } from './pipeCatalogHelpers.js';
import { resolvePumpCatalogId } from './pumpCatalogHelpers.js';
import { Product } from '../models/public.js';
import { logger } from '../utils/logger.js';
import { ensureMongoReferenceConnection } from '../utils/mongoReferenceConnection.js';
import { resolveCatalogJsonFilePath } from '../../scripts/utils/catalogPaths.js';

/**
 * Завантаження каталогу обладнання.
 *
 * - mongo: тільки колекція Product (production); порожня БД — помилка.
 * - file: тільки локальний JSON (offline dev).
 * - auto: Mongo; при недоступності БД — чистий файл без merge.
 */

/**
 * @param {unknown} json
 * @returns {number}
 */
function countBoilersInProductsJson(json) {
  if (!json || typeof json !== 'object') return 0;
  const products = /** @type {Record<string, unknown>} */ (json).products;
  if (!products || typeof products !== 'object') return 0;
  const boilers = /** @type {Record<string, unknown>} */ (products).boilers;
  if (!boilers || typeof boilers !== 'object') return 0;
  const dc = /** @type {unknown[]} */ (boilers).doubleCircuit;
  const sc = /** @type {unknown[]} */ (boilers).singleCircuit;
  return (Array.isArray(dc) ? dc.length : 0) + (Array.isArray(sc) ? sc.length : 0);
}

/**
 * @param {unknown} json
 * @returns {number}
 */
function countProductRowsInEnvelope(json) {
  if (!json || typeof json !== 'object') return 0;
  const products = /** @type {Record<string, unknown>} */ (json).products;
  if (!products || typeof products !== 'object') return 0;
  const boilers = countBoilersInProductsJson(json);
  const radiators = Array.isArray(products.radiators) ? products.radiators.length : 0;
  const waterHeaters = Array.isArray(products.waterHeaters)
    ? products.waterHeaters.length
    : 0;
  const pipes = Array.isArray(products.pipes) ? products.pipes.length : 0;
  const pumps = Array.isArray(/** @type {Record<string, unknown>} */ (json).pumps)
    ? /** @type {unknown[]} */ ((/** @type {Record<string, unknown>} */ (json)).pumps).length
    : Array.isArray(products.pumps)
      ? products.pumps.length
      : 0;
  const indirect = Array.isArray(
    /** @type {Record<string, unknown>} */ (json).indirectWaterHeaters,
  )
    ? /** @type {unknown[]} */ ((/** @type {Record<string, unknown>} */ (json)).indirectWaterHeaters)
        .length
    : 0;
  const manifolds = Array.isArray(/** @type {Record<string, unknown>} */ (json).manifold)
    ? /** @type {unknown[]} */ ((/** @type {Record<string, unknown>} */ (json)).manifold).length
    : 0;
  const boilerManifolds = Array.isArray(
    /** @type {Record<string, unknown>} */ (json).boilerManifold,
  )
    ? /** @type {unknown[]} */ ((/** @type {Record<string, unknown>} */ (json)).boilerManifold)
        .length
    : 0;
  return boilers + radiators + waterHeaters + pipes + pumps + indirect + manifolds + boilerManifolds;
}

/**
 * Убираем служебные поля MongoDB перед валидацией каталога.
 * @param {Record<string, unknown>} doc
 * @returns {Record<string, unknown>}
 */
function mongoDocToPlain(doc) {
  if (!doc || typeof doc !== 'object') return {};
  const {
    _id: _mongoId,
    __v: _mongoV,
    catalogKey: _catalogKey,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...rest
  } = doc;
  void _mongoId;
  void _mongoV;
  void _catalogKey;
  void _createdAt;
  void _updatedAt;
  return rest;
}

/**
 * Труба из Mongo → строка каталога (без kind, catalogKey, pipeId).
 * @param {Record<string, unknown>} doc
 */
function pipeMongoDocToCatalogRow(doc) {
  const plain = mongoDocToPlain(doc);
  const { kind: _k, pipeId: _p, ...rest } = plain;
  void _k;
  void _p;
  /** @type {Record<string, unknown>} */
  const row = { ...rest };
  const catalogId = resolvePipeCatalogId(plain);
  if (catalogId) {
    row.id = catalogId;
  }
  return row;
}

/**
 * Насос из Mongo → строка каталога (без kind, catalogKey, pumpId).
 * @param {Record<string, unknown>} doc
 */
function pumpMongoDocToCatalogRow(doc) {
  const plain = mongoDocToPlain(doc);
  const { kind: _k, pumpId: _p, ...rest } = plain;
  void _k;
  void _p;
  /** @type {Record<string, unknown>} */
  const row = { ...rest };
  const catalogId = resolvePumpCatalogId(plain);
  if (catalogId) {
    row.id = catalogId;
  }
  return row;
}

/**
 * @param {Record<string, unknown>} doc
 */
function mongoDocToCatalogProductDoc(doc) {
  const plain = mongoDocToPlain(doc);
  const { kind: _k, ...rest } = plain;
  void _k;
  return rest;
}

/**
 * @returns {Promise<unknown>}
 */
async function loadCatalogJsonFromFile() {
  const p = resolveCatalogJsonFilePath();
  let raw;
  try {
    raw = await fs.readFile(p, 'utf8');
  } catch (err) {
    const code = err && typeof err === 'object' ? /** @type {NodeJS.ErrnoException} */ (err).code : null;
    if (code === 'ENOENT') {
      throw new Error(
        `Файл каталога не найден: ${p}. Скопируйте backend/test_data.json.example → test_data.json ` +
          'или задайте CATALOG_FILE_PATH / SEED_CATALOG_PATH.',
        { cause: err },
      );
    }
    throw err;
  }
  return JSON.parse(raw);
}

/**
 * @returns {Promise<unknown>}
 */
async function loadCatalogJsonFromMongo() {
  const connected = await ensureMongoReferenceConnection();
  if (!connected) {
    throw new Error(
      'CATALOG_SOURCE=mongo|auto: не заданы MONGODB_URI или параметры подключения к MongoDB.',
    );
  }

  const docs = await Product.find({}).sort({ kind: 1, catalogKey: 1 }).lean();
  if (!docs.length) {
    throw new Error(
      'Каталог в MongoDB пуст (коллекция products). Выполните: cd backend && npm run seed',
    );
  }

  const boilers = docs
    .filter((d) => d.kind === 'boiler')
    .map((d) => mongoDocToCatalogProductDoc(/** @type {Record<string, unknown>} */ (d)));
  const radiators = docs
    .filter((d) => d.kind === 'radiator')
    .map((d) => mongoDocToCatalogProductDoc(/** @type {Record<string, unknown>} */ (d)));
  const waterHeaters = docs
    .filter((d) => d.kind === 'waterHeater')
    .map((d) => mongoDocToCatalogProductDoc(/** @type {Record<string, unknown>} */ (d)));
  const pipes = docs
    .filter((d) => d.kind === 'pipe')
    .map((d) => pipeMongoDocToCatalogRow(/** @type {Record<string, unknown>} */ (d)));
  const pumps = docs
    .filter((d) => d.kind === 'pump')
    .map((d) => pumpMongoDocToCatalogRow(/** @type {Record<string, unknown>} */ (d)));
  const indirectWaterHeaters = docs
    .filter((d) => d.kind === 'indirectWaterHeater')
    .map((d) => mongoDocToCatalogProductDoc(/** @type {Record<string, unknown>} */ (d)));
  const manifolds = docs
    .filter((d) => d.kind === 'manifold')
    .map((d) => mongoDocToCatalogProductDoc(/** @type {Record<string, unknown>} */ (d)));
  const boilerManifolds = docs
    .filter((d) => d.kind === 'boilerManifold')
    .map((d) => mongoDocToCatalogProductDoc(/** @type {Record<string, unknown>} */ (d)));

  /** @type {Array<Record<string, unknown> & { isDoubleCircuit?: boolean }>} */
  const doubleCircuit = [];
  /** @type {Array<Record<string, unknown> & { isDoubleCircuit?: boolean }>} */
  const singleCircuit = [];
  for (const b of boilers) {
    if (b.isDoubleCircuit) doubleCircuit.push(b);
    else singleCircuit.push(b);
  }

  const envelope = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    currency: 'UAH',
    products: {
      boilers: { doubleCircuit, singleCircuit },
      radiators,
      waterHeaters,
      pipes,
    },
    pumps,
    indirectWaterHeaters,
    manifold: manifolds,
    boilerManifold: boilerManifolds,
  };

  if (countBoilersInProductsJson(envelope) < 1) {
    throw new Error(
      'В MongoDB нет котлов (kind=boiler). Выполните: cd backend && npm run seed',
    );
  }

  if (countProductRowsInEnvelope(envelope) < 1) {
    throw new Error('Каталог в MongoDB не содержит номенклатуры products.');
  }

  return envelope;
}

/**
 * @param {'file' | 'mongo'} catalogSource
 * @param {unknown} json
 * @returns {{ catalog: import('./types').NormalizedCatalog, catalogSource: 'file' | 'mongo' }}
 */
function normalizeCatalogEnvelope(json, catalogSource) {
  const normalized = validateAndNormalizeCatalog(json);

  const radiators = [...normalized.radiators];
  const waterHeaters = [...normalized.waterHeaters];

  const nBoilersFinal =
    normalized.boilers.doubleCircuit.length + normalized.boilers.singleCircuit.length;
  logger.info('catalog.loaded', null, {
    catalogSource,
    boilers: nBoilersFinal,
    radiators: normalized.radiators.length,
    waterHeaters: normalized.waterHeaters.length,
    pipes: Array.isArray(normalized.pipes) ? normalized.pipes.length : 0,
    pumps: Array.isArray(normalized.pumps) ? normalized.pumps.length : 0,
    indirectWaterHeaters: Array.isArray(normalized.indirectWaterHeaters)
      ? normalized.indirectWaterHeaters.length
      : 0,
    manifolds: Array.isArray(normalized.manifolds) ? normalized.manifolds.length : 0,
    boilerManifolds: Array.isArray(normalized.boilerManifolds)
      ? normalized.boilerManifolds.length
      : 0,
  });

  return {
    catalog: {
      boilers: {
        doubleCircuit: normalized.boilers.doubleCircuit,
        singleCircuit: normalized.boilers.singleCircuit,
      },
      radiators,
      waterHeaters,
      pipes: Array.isArray(normalized.pipes) ? [...normalized.pipes] : [],
      pumps: Array.isArray(normalized.pumps) ? [...normalized.pumps] : [],
      indirectWaterHeaters: Array.isArray(normalized.indirectWaterHeaters)
        ? [...normalized.indirectWaterHeaters]
        : [],
      manifolds: Array.isArray(normalized.manifolds) ? [...normalized.manifolds] : [],
      boilerManifolds: Array.isArray(normalized.boilerManifolds)
        ? [...normalized.boilerManifolds]
        : [],
    },
    catalogSource,
  };
}

/**
 * @returns {Promise<{ catalog: import('./types').NormalizedCatalog, catalogSource: 'file' | 'mongo' }>}
 */
export async function loadCatalog() {
  const rawSource = String(process.env.CATALOG_SOURCE ?? 'auto').trim().toLowerCase();
  /** @type {'file' | 'mongo' | 'auto'} */
  let mode;
  if (rawSource === 'mongo') mode = 'mongo';
  else if (rawSource === 'file') mode = 'file';
  else if (rawSource === 'auto') mode = 'auto';
  else {
    logger.warn('catalog.source.unknown', null, { value: rawSource, fallback: 'auto' });
    mode = 'auto';
  }

  if (mode === 'mongo') {
    const json = await loadCatalogJsonFromMongo();
    return normalizeCatalogEnvelope(json, 'mongo');
  }

  if (mode === 'file') {
    const json = await loadCatalogJsonFromFile();
    return normalizeCatalogEnvelope(json, 'file');
  }

  try {
    const json = await loadCatalogJsonFromMongo();
    logger.info('catalog.auto', null, { decision: 'mongo' });
    return normalizeCatalogEnvelope(json, 'mongo');
  } catch (err) {
    logger.warn('catalog.auto', null, {
      decision: 'file',
      reason: 'mongo_unavailable_or_empty',
      message: err instanceof Error ? err.message : String(err),
    });
    const json = await loadCatalogJsonFromFile();
    return normalizeCatalogEnvelope(json, 'file');
  }
}
