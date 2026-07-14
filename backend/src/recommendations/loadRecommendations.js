/**
 * Назначение: загрузка справочника recommendations.
 * Описание: чтение текстов рекомендаций по code из MongoDB (коллекция recommendations) или файла
 * backend/data/recommendations.json с режимами file, mongo и auto.
 */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Recommendation } from '../models/Recommendation.js';
import { validateAndNormalizeRecommendationsBundle } from './validateRecommendations.js';
import { ensureMongoReferenceConnection } from '../utils/mongoReferenceConnection.js';
import {
  loadReferenceCollection,
  stripMongoDocMeta,
} from '../reference/loadReferenceCollection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'recommendations.json');

/**
 * @returns {Promise<unknown[]>}
 */
async function loadRecommendationsJsonFromFile() {
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('recommendations.json: ожидается массив');
  }
  return parsed;
}

/**
 * @returns {Promise<unknown[]>}
 */
async function loadRecommendationsJsonFromMongo() {
  const connected = await ensureMongoReferenceConnection();
  if (!connected) throw new Error('MongoDB не настроен для recommendations');
  const docs = await Recommendation.find({ isActive: true }).lean();
  if (!docs.length) throw new Error('Коллекция recommendations пуста');
  return docs.map((doc) =>
    stripMongoDocMeta(/** @type {Record<string, unknown>} */ (doc)),
  );
}

/**
 * @returns {Promise<{ recommendations: import('./types.js').RecommendationsBundle, recommendationsSource: 'file' | 'mongo' }>}
 */
export async function loadRecommendations() {
  const { data, source } = await loadReferenceCollection({
    envVar: 'RECOMMENDATIONS_SOURCE',
    logKey: 'recommendations',
    loadFromFile: loadRecommendationsJsonFromFile,
    loadFromMongo: loadRecommendationsJsonFromMongo,
    normalize: (json, recommendationsSource) =>
      validateAndNormalizeRecommendationsBundle(json, recommendationsSource),
    logLoaded: (recommendations, recommendationsSource) => ({
      recommendationsSource,
      codes: Object.keys(recommendations.byCode),
    }),
  });

  return { recommendations: data, recommendationsSource: source };
}
