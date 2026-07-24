/**
 * Назначение: назначить role=admin пользователю по email (Фаза 2 bootstrap).
 * Запуск: cd backend && npm run promote:user-admin -- --email user@example.com
 */
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { User } from '../src/models/User.js';
import { ensureMongoReferenceConnection } from '../src/utils/mongoReferenceConnection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, '..', '.env') });

/** @param {boolean} ok @param {string} label */
function logLine(ok, label) {
  console.log(ok ? 'OK' : 'FAIL', '—', label);
}

/**
 * @returns {string | null}
 */
function readEmailArg() {
  const idx = process.argv.indexOf('--email');
  if (idx === -1) return null;
  const value = process.argv[idx + 1];
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

/**
 * @returns {Promise<void>}
 */
async function main() {
  const email = readEmailArg();
  if (!email) {
    console.error('Укажите --email user@example.com');
    process.exitCode = 1;
    return;
  }

  const connected = await ensureMongoReferenceConnection();
  if (!connected) {
    console.error('MongoDB недоступна. Задайте MONGODB_URI в backend/.env');
    process.exitCode = 1;
    return;
  }

  const user = await User.findOneAndUpdate(
    { email },
    { $set: { role: 'admin' } },
    { new: true, runValidators: true },
  );

  if (!user) {
    console.error(`Пользователь с email ${email} не найден. Сначала выполните login через Clerk.`);
    process.exitCode = 1;
    return;
  }

  logLine(true, `role=admin для ${email} (id=${String(user._id)})`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
