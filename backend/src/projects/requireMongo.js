/**
 * Назначение: проверка доступности MongoDB для проектов.
 * Описание: гарантирует наличие конфигурации и успешное подключение перед операциями API
 * сохранения проектов; при недоступности — ошибка 503 MONGODB_UNAVAILABLE.
 */
import { ensureMongoReferenceConnection } from '../utils/mongoReferenceConnection.js';
import { createAppError } from '../utils/createAppError.js';

/**
 * Подключение к MongoDB обязательно для API проектов.
 * @returns {Promise<void>}
 */
export async function requireMongoForProjects() {
  const cfgMissing = !process.env.MONGODB_URI?.trim() &&
    !process.env.MONGODB_URI_FALLBACK?.trim() &&
    !(
      process.env.MONGODB_USER?.trim() &&
      process.env.MONGODB_PASSWORD?.trim() &&
      process.env.MONGODB_URL?.trim() &&
      process.env.MONGODB_DB?.trim()
    );

  if (cfgMissing) {
    throw createAppError(
      'Сохранение проектов недоступно: задайте MONGODB_URI или MONGODB_USER/PASSWORD/URL/DB в backend/.env',
      'MONGODB_UNAVAILABLE',
      503,
    );
  }

  try {
    const ok = await ensureMongoReferenceConnection();
    if (!ok) {
      throw createAppError('Не удалось подключиться к MongoDB.', 'MONGODB_UNAVAILABLE', 503);
    }
  } catch (connectErr) {
    throw createAppError(
      connectErr instanceof Error ? connectErr.message : 'Не удалось подключиться к MongoDB.',
      'MONGODB_UNAVAILABLE',
      503,
    );
  }
}
