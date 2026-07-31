/**
 * Назначение: smoke-проверка коллекций MongoDB после seed.
 * Описание: подключается к БД из backend/.env с подменой имени БД; выводит counts и минимальные инварианты.
 */
import { config as loadEnv } from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyMongoFriendlyDnsIfSrvInCandidates } from '../src/utils/mongoDnsPreferPublic.js';
import { getMongoConnectionConfigs } from '../src/utils/mongoConnectionConfig.js';

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
    'Укажите имя БД: node scripts/verifyMongoDatabase.mjs <databaseName> или SEED_MONGODB_DB',
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

process.env.MONGODB_URI = withDatabaseName(sourceUri, databaseName);
process.env.MONGODB_DB = databaseName;

/** @type {{ name: string, minCount: number }[]} */
const REQUIRED_COLLECTIONS = [
  { name: 'products', minCount: 1 },
  { name: 'water_norms', minCount: 1 },
  { name: 'appliances', minCount: 1 },
  { name: 'recommendations', minCount: 1 },
  { name: 'underfloor_heating_presets', minCount: 1 },
];

/**
 * @returns {Promise<void>}
 */
async function main() {
  const candidates = getMongoConnectionConfigs();
  if (candidates.length === 0) {
    throw new Error('Нет кандидатов MongoDB в .env');
  }

  applyMongoFriendlyDnsIfSrvInCandidates(candidates.map((c) => c.uri));

  let lastError = null;
  for (const candidate of candidates) {
    try {
      await mongoose.connect(candidate.uri, candidate.options);
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (mongoose.connection.readyState !== 1) {
    throw lastError ?? new Error('Не удалось подключиться к MongoDB');
  }

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('connection.db недоступен');
  }

  const dbName = db.databaseName;
  const existing = new Set(await db.listCollections().toArray().then((rows) => rows.map((r) => r.name)));

  /** @type {Record<string, number>} */
  const counts = {};
  /** @type {string[]} */
  const errors = [];

  for (const { name, minCount } of REQUIRED_COLLECTIONS) {
    if (!existing.has(name)) {
      counts[name] = 0;
      errors.push(`коллекция отсутствует: ${name}`);
      continue;
    }
    const count = await db.collection(name).countDocuments();
    counts[name] = count;
    if (count < minCount) {
      errors.push(`${name}: count=${count}, ожидалось >= ${minCount}`);
    }
  }

  /** @type {Record<string, number>} */
  let productsByKind = {};
  if (existing.has('products')) {
    const agg = await db
      .collection('products')
      .aggregate([{ $group: { _id: '$kind', n: { $sum: 1 } } }, { $sort: { _id: 1 } }])
      .toArray();
    productsByKind = Object.fromEntries(
      agg.map((row) => [String(row._id ?? 'unknown'), Number(row.n ?? 0)]),
    );
  }

  const report = {
    ok: errors.length === 0,
    database: dbName,
    uri: redactMongoUri(process.env.MONGODB_URI),
    counts,
    productsByKind,
    errors,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
