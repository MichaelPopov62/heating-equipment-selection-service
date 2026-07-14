/**
 * Назначение: загрузка справочника water_norms.
 * Описание: чтение норм ГВС из MongoDB (коллекция water_norms) или файла backend/data/water_norms.json
 * с режимами file, mongo и auto через loadReferenceCollection.
 */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WaterNorms } from '../models/WaterNorms.js';
import { validateAndNormalizeWaterNorms } from './validateWaterNorms.js';
import { logger } from '../utils/logger.js';
import {
  resolveReferenceSourceMode,
} from '../utils/mongoConnectionConfig.js';
import { ensureMongoReferenceConnection } from '../utils/mongoReferenceConnection.js';
import {
  loadReferenceCollection,
  stripMongoDocMeta,
} from '../reference/loadReferenceCollection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'water_norms.json');

/**
 * @returns {Promise<unknown>}
 */
async function loadWaterNormsJsonFromFile() {
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

/**
 * @returns {Promise<unknown>}
 */
async function loadWaterNormsJsonFromMongo() {
  const connected = await ensureMongoReferenceConnection();
  if (!connected) throw new Error('MongoDB не настроен для water_norms');
  const doc = await WaterNorms.findOne({ isActive: true })
    .sort({ schemaVersion: -1, updatedAt: -1 })
    .lean();
  if (!doc) throw new Error('Коллекция water_norms пуста или нет isActive');
  return stripMongoDocMeta(/** @type {Record<string, unknown>} */ (doc));
}

/**
 * @returns {Promise<{ waterNorms: import('./types.js').NormalizedWaterNorms, waterNormsSource: 'file' | 'mongo' }>}
 */
export async function loadWaterNorms() {
  const mode = resolveReferenceSourceMode('WATER_NORMS_SOURCE', 'auto');

  try {
    const { data, source } = await loadReferenceCollection({
      envVar: 'WATER_NORMS_SOURCE',
      logKey: 'water_norms',
      loadFromFile: loadWaterNormsJsonFromFile,
      loadFromMongo: loadWaterNormsJsonFromMongo,
      normalize: (json) => validateAndNormalizeWaterNorms(json),
      logLoaded: (waterNorms, waterNormsSource) => ({
        waterNormsSource,
        schemaVersion: waterNorms.schemaVersion,
        label: waterNorms.label,
      }),
    });

    return { waterNorms: data, waterNormsSource: source };
  } catch (err) {
    // Устаревший документ в Mongo (нет новых полей) — в auto откатываемся на файл.
    if (mode !== 'auto') throw err;

    logger.warn('water_norms.auto', null, {
      decision: 'file',
      reason: 'normalize_error',
      message: err instanceof Error ? err.message : String(err),
    });

    const json = await loadWaterNormsJsonFromFile();
    const waterNorms = validateAndNormalizeWaterNorms(json);
    logger.info('water_norms.loaded', null, {
      waterNormsSource: 'file',
      schemaVersion: waterNorms.schemaVersion,
      label: waterNorms.label,
    });

    return { waterNorms, waterNormsSource: 'file' };
  }
}
