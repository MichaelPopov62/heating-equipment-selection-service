/**
 * Назначение: загрузка справочника appliances.
 * Описание: чтение правил подбора по типам техники из MongoDB (коллекция appliances) или файла
 * backend/data/appliances.json с режимами file, mongo и auto.
 */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Appliance } from '../models/Appliance.js';
import { validateAndNormalizeAppliancesBundle } from './validateAppliances.js';
import { ensureMongoReferenceConnection } from '../utils/mongoReferenceConnection.js';
import {
  loadReferenceCollection,
  stripMongoDocMeta,
} from '../reference/loadReferenceCollection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'appliances.json');

/**
 * @returns {Promise<unknown>}
 */
async function loadAppliancesJsonFromFile() {
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

/**
 * @returns {Promise<unknown[]>}
 */
async function loadAppliancesJsonFromMongo() {
  const connected = await ensureMongoReferenceConnection();
  if (!connected) throw new Error('MongoDB не настроен для appliances');
  const docs = await Appliance.find({ isActive: true }).lean();
  if (!docs.length) throw new Error('Коллекция appliances пуста');
  return docs.map((doc) =>
    stripMongoDocMeta(/** @type {Record<string, unknown>} */ (doc)),
  );
}

/**
 * @returns {Promise<{ appliances: import('./types.js').AppliancesBundle, appliancesSource: 'file' | 'mongo' }>}
 */
export async function loadAppliances() {
  const { data, source } = await loadReferenceCollection({
    envVar: 'APPLIANCES_SOURCE',
    logKey: 'appliances',
    loadFromFile: loadAppliancesJsonFromFile,
    loadFromMongo: loadAppliancesJsonFromMongo,
    normalize: (json, appliancesSource) =>
      validateAndNormalizeAppliancesBundle(json, appliancesSource),
    logLoaded: (appliances, appliancesSource) => ({
      appliancesSource,
      kinds: Object.keys(appliances.byKind),
    }),
  });

  return { appliances: data, appliancesSource: source };
}
