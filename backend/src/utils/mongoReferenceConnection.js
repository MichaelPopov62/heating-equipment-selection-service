/**
 * Назначение: единое подключение MongoDB для чтения справочников.
 * Описание: Одно соединение на процесс для products, water_norms, appliances и recommendations без reconnect при обновлении кэша.
 */

import mongoose from 'mongoose';
import { getMongoConnectionConfigOrNull } from './mongoConnectionConfig.js';
import { applyMongoFriendlyDnsForUri } from './mongoDnsPreferPublic.js';

/** @type {Promise<void> | null} */
let connectPromise = null;

/**
 * @returns {boolean}
 */
function isMongoConnected() {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

/**
 * Подключиться к MongoDB, если заданы переменные окружения.
 * @returns {Promise<boolean>} true, если соединение установлено
 */
export async function ensureMongoReferenceConnection() {
  const cfg = getMongoConnectionConfigOrNull();
  if (!cfg) return false;

  if (isMongoConnected()) return true;

  if (!connectPromise) {
    applyMongoFriendlyDnsForUri(cfg.uri);
    connectPromise = mongoose
      .connect(cfg.uri, cfg.options)
      .then(() => undefined)
      .catch((err) => {
        connectPromise = null;
        throw err;
      });
  }

  await connectPromise;
  return isMongoConnected();
}
