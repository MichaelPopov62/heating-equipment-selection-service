/**
 * Назначение: общий загрузчик справочных коллекций.
 * Описание: единый шаблон чтения file | mongo | auto с fallback для water_norms, appliances
 * и recommendations; очистка служебных полей MongoDB перед валидацией.
 */
import { logger } from '../utils/logger.js';
import {
  getMongoConnectionConfigOrNull,
  resolveReferenceSourceMode,
} from '../utils/mongoConnectionConfig.js';

/** @typedef {'file' | 'mongo'} ReferenceSource */

/**
 * Убирает служебные поля MongoDB перед валидацией.
 * @param {Record<string, unknown>} doc
 * @returns {Record<string, unknown>}
 */
export function stripMongoDocMeta(doc) {
  const { _id, __v, createdAt, updatedAt, ...rest } = doc;
  void _id;
  void __v;
  void createdAt;
  void updatedAt;
  return rest;
}

/**
 * @template T
 * @param {{
 *   envVar: string,
 *   logKey: string,
 *   loadFromFile: () => Promise<unknown>,
 *   loadFromMongo: () => Promise<unknown>,
 *   normalize: (json: unknown, source: ReferenceSource) => T,
 *   logLoaded?: (data: T, source: ReferenceSource) => Record<string, unknown>,
 * }} opts
 * @returns {Promise<{ data: T, source: ReferenceSource }>}
 */
export async function loadReferenceCollection(opts) {
  const mode = resolveReferenceSourceMode(opts.envVar, 'auto');

  /** @type {unknown} */
  let json;
  /** @type {ReferenceSource} */
  let source;

  if (mode === 'mongo') {
    json = await opts.loadFromMongo();
    source = 'mongo';
  } else if (mode === 'file') {
    json = await opts.loadFromFile();
    source = 'file';
  } else {
    const cfg = getMongoConnectionConfigOrNull();
    if (!cfg) {
      logger.info(`${opts.logKey}.auto`, null, {
        decision: 'file',
        reason: 'mongo_env_missing',
      });
      json = await opts.loadFromFile();
      source = 'file';
    } else {
      try {
        json = await opts.loadFromMongo();
        source = 'mongo';
        logger.info(`${opts.logKey}.auto`, null, { decision: 'mongo' });
      } catch (err) {
        logger.warn(`${opts.logKey}.auto`, null, {
          decision: 'file',
          reason: 'mongo_error',
          message: err instanceof Error ? err.message : String(err),
        });
        json = await opts.loadFromFile();
        source = 'file';
      }
    }
  }

  const data = opts.normalize(json, source);
  const loadedMeta = opts.logLoaded?.(data, source) ?? { source };
  logger.info(`${opts.logKey}.loaded`, null, loadedMeta);

  return { data, source };
}
