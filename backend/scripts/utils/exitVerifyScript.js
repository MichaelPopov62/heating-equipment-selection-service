/**
 * Назначение: корректное завершение verify-скриптов после чтения справочников из MongoDB.
 * Описание: Mongoose держит event loop открытым — без disconnect + process.exit npm run verify
 * зависает между шагами цепочки (только process.exitCode недостаточно).
 */
import mongoose from 'mongoose';

/**
 * Закрывает MongoDB (если было подключение) и завершает процесс с заданным кодом.
 *
 * @param {number} [exitCode=0]
 * @returns {Promise<never>}
 */
export async function exitVerifyScript(exitCode = 0) {
  if (mongoose.connection.readyState !== mongoose.ConnectionStates.disconnected) {
    await mongoose.disconnect().catch(() => undefined);
  }
  process.exit(exitCode);
}
