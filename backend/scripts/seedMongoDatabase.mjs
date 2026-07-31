/**
 * Назначение: seed MongoDB с подменой имени БД в MONGODB_URI из backend/.env.
 * Описание: credentials не передаются в CLI — берутся из .env; имя БД — аргумент или SEED_MONGODB_DB.
 */
import { spawn } from 'node:child_process';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.join(__dirname, '..');

loadEnv({ path: path.join(backendRoot, '.env') });

/**
 * @param {string} uri
 * @param {string} databaseName
 * @returns {string}
 */
function withDatabaseName(uri, databaseName) {
  const url = new URL(uri.trim());
  url.pathname = `/${databaseName}`;
  if (!url.searchParams.has('retryWrites')) {
    url.searchParams.set('retryWrites', 'true');
  }
  if (!url.searchParams.has('w')) {
    url.searchParams.set('w', 'majority');
  }
  return url.toString();
}

/**
 * @param {string} uri
 * @returns {string}
 */
function redactMongoUri(uri) {
  try {
    const url = new URL(uri);
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return '***';
  }
}

const databaseName =
  process.argv[2]?.trim() || process.env.SEED_MONGODB_DB?.trim() || '';

if (!databaseName) {
  console.error(
    'Укажите имя БД: node scripts/seedMongoDatabase.mjs <databaseName> или SEED_MONGODB_DB',
  );
  process.exitCode = 1;
  process.exit(1);
}

const sourceUri = process.env.MONGODB_URI?.trim();
if (!sourceUri) {
  console.error('MONGODB_URI не задан в backend/.env');
  process.exitCode = 1;
  process.exit(1);
}

const targetUri = withDatabaseName(sourceUri, databaseName);
process.env.MONGODB_URI = targetUri;
process.env.MONGODB_DB = databaseName;

console.log(
  JSON.stringify({
    seedTarget: {
      database: databaseName,
      uri: redactMongoUri(targetUri),
    },
  }),
);

const child = spawn(process.execPath, ['scripts/seed.js'], {
  cwd: backendRoot,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
