/**
 * Назначение: загрузка справочника underfloor_heating_presets.
 * Описание: MongoDB коллекция underfloor_heating_presets или backend/data/underfloor_heating_presets.json.
 */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UnderfloorHeatingPreset } from '../models/UnderfloorHeatingPreset.js';
import { validateAndNormalizeUnderfloorHeatingPresets } from './validateUnderfloorHeatingPresets.js';
import { logger } from '../utils/logger.js';
import { resolveReferenceSourceMode } from '../utils/mongoConnectionConfig.js';
import { ensureMongoReferenceConnection } from '../utils/mongoReferenceConnection.js';
import {
  loadReferenceCollection,
  stripMongoDocMeta,
} from '../reference/loadReferenceCollection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'underfloor_heating_presets.json');

/**
 * @returns {Promise<unknown>}
 */
async function loadUfhPresetsJsonFromFile() {
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

/**
 * @returns {Promise<unknown>}
 */
async function loadUfhPresetsJsonFromMongo() {
  const connected = await ensureMongoReferenceConnection();
  if (!connected) throw new Error('MongoDB не настроен для underfloor_heating_presets');
  const docs = await UnderfloorHeatingPreset.find({ isActive: true, kind: 'ufhPreset' })
    .sort({ presetId: 1 })
    .lean();
  if (!docs?.length) {
    throw new Error('Коллекция underfloor_heating_presets пуста или нет isActive');
  }
  return docs.map((d) => stripMongoDocMeta(/** @type {Record<string, unknown>} */ (d)));
}

/**
 * @returns {Promise<{ ufhPresets: import('./types').UnderfloorHeatingPresetsBundle, ufhPresetsSource: 'file' | 'mongo' }>}
 */
export async function loadUnderfloorHeatingPresets() {
  const mode = resolveReferenceSourceMode('UFH_PRESETS_SOURCE', 'auto');

  try {
    const { data, source } = await loadReferenceCollection({
      envVar: 'UFH_PRESETS_SOURCE',
      logKey: 'ufh_presets',
      loadFromFile: loadUfhPresetsJsonFromFile,
      loadFromMongo: loadUfhPresetsJsonFromMongo,
      normalize: (json) => validateAndNormalizeUnderfloorHeatingPresets(json),
      logLoaded: (bundle, ufhPresetsSource) => ({
        ufhPresetsSource,
        schemaVersion: bundle.schemaVersion,
        presetIds: bundle.presets.map((p) => p.presetId),
      }),
    });

    return { ufhPresets: data, ufhPresetsSource: source };
  } catch (err) {
    if (mode !== 'auto') throw err;

    logger.warn('ufh_presets.auto', null, {
      decision: 'file',
      reason: 'normalize_error',
      message: err instanceof Error ? err.message : String(err),
    });

    const json = await loadUfhPresetsJsonFromFile();
    const ufhPresets = validateAndNormalizeUnderfloorHeatingPresets(json);
    logger.info('ufh_presets.loaded', null, {
      ufhPresetsSource: 'file',
      schemaVersion: ufhPresets.schemaVersion,
    });
    return { ufhPresets, ufhPresetsSource: 'file' };
  }
}
