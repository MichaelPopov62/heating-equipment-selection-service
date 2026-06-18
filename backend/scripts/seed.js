/**
 * Назначение: заполнение MongoDB каталогом оборудования и справочниками.
 * Описание: [1/3] pre-validation JSON, [2/3] запись products через discriminators,
 * [3/3] post-seed smoke через loadCatalog(CATALOG_SOURCE=mongo).
 * SSOT policy.
 */
import { config as loadEnv } from 'dotenv';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs/promises';
import { loadCatalog } from '../src/catalog/public.js';
import { Product } from '../src/models/Product.js';
import { Boiler } from '../src/models/Boiler.js';
import { Radiator } from '../src/models/Radiator.js';
import { WaterHeater } from '../src/models/WaterHeater.js';
import { Pipe } from '../src/models/Pipe.js';
import { IndirectWaterHeater } from '../src/models/IndirectWaterHeater.js';
import { resolveCatalogJsonFilePath } from './utils/catalogPaths.js';
import {
  summarizeNormalizedCatalog,
  validateAndBuildProductDocuments,
} from './utils/catalogSeedBuild.js';
import { applyMongoFriendlyDnsIfSrvInCandidates } from '../src/utils/mongoDnsPreferPublic.js';
import { getMongoConnectionConfigs } from '../src/utils/mongoConnectionConfig.js';
import { seedReferenceDataCollections } from './seedReferenceData.js';
import { tryInvalidateReferenceCacheRemote } from './utils/invalidateReferenceCacheRemote.js';

const __dirnameSeed = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirnameSeed, '..', '.env') });

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

/**
 * @param {unknown} err
 * @returns {boolean}
 */
function isSrvDnsError(err) {
  const code = err && typeof err === 'object' ? /** @type {{ code?: string }} */ (err).code : undefined;
  const syscall = err && typeof err === 'object' ? /** @type {{ syscall?: string }} */ (err).syscall : undefined;
  return (
    syscall === 'querySrv' &&
    (code === 'ECONNREFUSED' || code === 'ENODATA' || code === 'ENOTFOUND')
  );
}

/**
 * Загрузка и валидация JSON-каталога до подключения к MongoDB.
 * При ошибке validateAndNormalizeCatalog сидинг не начинается (коллекция не очищается).
 *
 * @param {string} catalogPath
 * @returns {Promise<{ docs: Record<string, unknown>[] }>}
 */
async function loadValidatedCatalogDocuments(catalogPath) {
  let raw;
  try {
    raw = await fs.readFile(catalogPath, 'utf-8');
  } catch (err) {
    const code = err && typeof err === 'object' ? /** @type {NodeJS.ErrnoException} */ (err).code : null;
    if (code === 'ENOENT') {
      throw new Error(
        `Файл каталога для seed не найден: ${catalogPath}. ` +
          'Скопируйте backend/test_data.json.example → backend/test_data.json',
        { cause: err },
      );
    }
    throw err;
  }

  const parsed = JSON.parse(raw);

  process.stdout.write(
    `[1/3] Pre-validation: validateAndNormalizeCatalog из ${catalogPath}…\n`,
  );

  let normalized;
  let docs;
  try {
    ({ normalized, docs } = validateAndBuildProductDocuments(parsed));
  } catch (err) {
    process.stderr.write(
      'Сидинг заблокирован: JSON не прошёл validateAndNormalizeCatalog (контракт SSOT).\n',
    );
    throw err;
  }

  const summary = summarizeNormalizedCatalog(normalized);
  process.stdout.write(
    `Каталог прошёл контракт SSOT: ${docs.length} документов products ` +
      `(boiler ${summary.boilerDouble + summary.boilerSingle}, radiator ${summary.radiators}, ` +
      `waterHeater ${summary.waterHeaters}, pipe ${summary.pipes}, ` +
      `indirect ${summary.indirectWaterHeaters})\n`,
  );

  return { docs };
}

/**
 * Сумма позиций нормализованного каталога.
 *
 * @param {Record<string, number>} summary
 * @returns {number}
 */
function countCatalogSummaryItems(summary) {
  return (
    summary.boilerDouble +
    summary.boilerSingle +
    summary.radiators +
    summary.waterHeaters +
    summary.pipes +
    summary.indirectWaterHeaters
  );
}

/**
 * Post-seed smoke: round-trip Mongo → envelope → validateAndNormalizeCatalog (как runtime).
 *
 * @param {number} expectedDocCount
 * @returns {Promise<void>}
 */
async function runPostSeedCatalogSmoke(expectedDocCount) {
  process.stdout.write('[3/3] Post-seed smoke: loadCatalog(mongo)…\n');

  const prevSource = process.env.CATALOG_SOURCE;
  process.env.CATALOG_SOURCE = 'mongo';

  try {
    const { catalog, catalogSource } = await loadCatalog();

    if (catalogSource !== 'mongo') {
      throw new Error(
        `Post-seed smoke: ожидался catalogSource=mongo, получен ${String(catalogSource)}`,
      );
    }

    const summary = summarizeNormalizedCatalog(catalog);
    const loadedCount = countCatalogSummaryItems(summary);

    if (loadedCount !== expectedDocCount) {
      throw new Error(
        `Post-seed smoke: round-trip count mismatch — expected ${expectedDocCount}, loadCatalog вернул ${loadedCount}`,
      );
    }

    process.stdout.write(
      `Post-seed smoke: OK (${loadedCount} позиций, round-trip validateAndNormalizeCatalog)\n`,
    );
  } catch (err) {
    process.stderr.write(
      'Post-seed smoke FAILED: данные уже записаны в products; исправьте JSON и перезапустите seed.\n',
    );
    throw err;
  } finally {
    if (prevSource === undefined) {
      delete process.env.CATALOG_SOURCE;
    } else {
      process.env.CATALOG_SOURCE = prevSource;
    }
  }
}

/**
 * @param {string} mongoUri
 * @param {import('mongoose').ConnectOptions | undefined} connectOptions
 */
function logMongoConnectDebug(mongoUri, connectOptions) {
  const enabled =
    process.env.SEED_DEBUG_MONGO === '1' ||
    process.env.SEED_DEBUG_MONGO === 'true';
  if (!enabled) return;

  try {
    const url = new URL(mongoUri);
    const passFromUri = url.password ? decodeURIComponent(url.password) : '';
    const passFromEnv = process.env.MONGODB_PASSWORD?.trim() ?? '';
    const userFromOptions = connectOptions?.user
      ? String(connectOptions.user)
      : null;
    const passFromOptions = connectOptions?.pass
      ? String(connectOptions.pass)
      : '';
    console.log(
      JSON.stringify(
        {
          mongoDebug: {
            protocol: url.protocol.replace(':', ''),
            host: url.hostname,
            dbPath: url.pathname,
            user: url.username
              ? decodeURIComponent(url.username)
              : userFromOptions,
            hasPassword: Boolean(url.password) || Boolean(connectOptions?.pass),
            passwordLengthInUri: passFromUri ? passFromUri.length : 0,
            passwordLengthInEnv: passFromEnv ? passFromEnv.length : 0,
            passwordLengthInConnectOptions: passFromOptions
              ? passFromOptions.length
              : 0,
            passwordLooksUrlEncodedInEnv: /%[0-9A-Fa-f]{2}/.test(passFromEnv),
            authMechanism:
              connectOptions?.authMechanism ??
              url.searchParams.get('authMechanism'),
            authSource:
              connectOptions?.authSource ?? url.searchParams.get('authSource'),
            retryWrites: url.searchParams.get('retryWrites'),
            w: url.searchParams.get('w'),
          },
        },
        null,
        2,
      ),
    );
  } catch {
    console.log(JSON.stringify({ mongoDebug: { parseError: true } }, null, 2));
  }
}

async function main() {
  const catalogPath = resolveCatalogJsonFilePath();
  const { docs } = await loadValidatedCatalogDocuments(catalogPath);

  const candidates = getMongoConnectionConfigs();
  if (candidates.length === 0) {
    throw new Error(
      'Задайте MONGODB_URI або повний набір MONGODB_USER, MONGODB_PASSWORD, MONGODB_URL, MONGODB_DB',
    );
  }
  applyMongoFriendlyDnsIfSrvInCandidates(candidates.map((c) => c.uri));

  try {
    let connected = false;
    let lastErr = null;
    for (const cand of candidates) {
      const mongoUri = cand.uri;
      const mongoOptions = cand.options;
      logMongoConnectDebug(mongoUri, mongoOptions);

      try {
        await mongoose.connect(mongoUri, mongoOptions);
        connected = true;
        break;
      } catch (err) {
        lastErr = err;
        const code = err && typeof err === 'object' ? /** @type {{ code?: number }} */ (err).code : undefined;
        const msg = String(err instanceof Error ? err.message : err);
        const syscall = err && typeof err === 'object' ? /** @type {{ syscall?: string }} */ (err).syscall : undefined;
        const hostname = err && typeof err === 'object' ? /** @type {{ hostname?: string }} */ (err).hostname : undefined;

        if (isSrvDnsError(err)) {
          console.error(
            JSON.stringify(
              {
                ok: false,
                error: 'DNS SRV lookup failed for MongoDB Atlas (mongodb+srv)',
                tried: cand.label,
                details: { code, syscall, hostname },
                hint: [
                  'Исправление в проекте: перед connect включён обход через публичные DNS (если не задано MONGODB_DISABLE_PUBLIC_DNS=1).',
                  'Либо используйте MONGODB_URI_FALLBACK вида mongodb:// (без +srv) из Atlas.',
                  'Либо смените системный DNS на 1.1.1.1 / 8.8.8.8.',
                ],
              },
              null,
              2,
            ),
          );
          continue;
        }

        if (code === 8000 || msg.includes('bad auth')) {
          console.error(
            JSON.stringify(
              {
                ok: false,
                error: 'MongoDB authentication failed (bad auth)',
                tried: cand.label,
                hint: [
                  'Проверь Database User в Atlas (Database Access → Edit Password) и значения в .env.',
                  'Если пароль содержит спецсимволы — предпочитай MONGODB_URI (как выдаёт Atlas Drivers) или корректно URL-encoded пароль.',
                ],
                mongoUriRedacted: redactMongoUri(mongoUri),
              },
              null,
              2,
            ),
          );
        }
      }
    }

    if (!connected) throw lastErr ?? new Error('MongoDB connect failed');

    process.stdout.write('[2/3] Write: products → MongoDB (discriminators)…\n');

    // Сначала очистка: иначе syncIndexes() не сможет создать unique { kind, catalogKey } —
    // в коллекции оставались старые документы без catalogKey (Mongo трактует null как дубликат).
    await Product.deleteMany({});

    // Синхронизация индексов на пустой коллекции: убираем legacy kind_1_model_1, добавляем kind_1_catalogKey_1.
    await Product.syncIndexes();

    const boilerDocs = docs.filter((d) => d.kind === 'boiler');
    const radiatorDocs = docs.filter((d) => d.kind === 'radiator');
    const waterHeaterDocs = docs.filter((d) => d.kind === 'waterHeater');
    const pipeDocs = docs.filter((d) => d.kind === 'pipe');
    const indirectDocs = docs.filter((d) => d.kind === 'indirectWaterHeater');

    let inserted;
    try {
      // Вставка через дискриминаторы: при Product.insertMany() Mongoose может неверно
      // назначить схему части документов, тогда в БД нет kind: "pipe" и фильтр в Compass пустой.
      const [insBoilers, insRad, insWh, insPipes, insIndirect] = await Promise.all([
        Boiler.insertMany(boilerDocs, { ordered: false }),
        Radiator.insertMany(radiatorDocs, { ordered: false }),
        WaterHeater.insertMany(waterHeaterDocs, { ordered: false }),
        Pipe.insertMany(pipeDocs, { ordered: false }),
        IndirectWaterHeater.insertMany(indirectDocs, { ordered: false }),
      ]);
      inserted = [...insBoilers, ...insRad, ...insWh, ...insPipes, ...insIndirect];
    } catch (err) {
      const bulk = err && typeof err === 'object' ? err : null;
      const insertedCount =
        bulk?.insertedDocs?.length ?? bulk?.result?.insertedCount ?? null;
      const writeErrors = bulk?.writeErrors ?? bulk?.mongoose?.validationErrors ?? null;
      console.error(
        JSON.stringify(
          {
            ok: false,
            phase: 'insertMany',
            message: String(bulk?.message ?? err),
            insertedSoFar: insertedCount,
            writeErrors:
              Array.isArray(writeErrors) && writeErrors.length
                ? writeErrors.slice(0, 10)
                : undefined,
          },
          null,
          2,
        ),
      );
      throw err;
    }

    const collName = Product.collection.collectionName;
    const dbName = mongoose.connection.db?.databaseName ?? '?';
    const verifyAgg = await mongoose.connection.db
      .collection(collName)
      .aggregate([{ $group: { _id: '$kind', n: { $sum: 1 } } }, { $sort: { _id: 1 } }])
      .toArray();
    const pipeInDb = verifyAgg.find((x) => x._id === 'pipe')?.n ?? 0;
    if (pipeInDb !== pipeDocs.length) {
      throw new Error(
        `insertMany: pipe в Mongo (${pipeInDb}) не совпало с сидом (${pipeDocs.length}); db=${dbName}, collection=${collName}`,
      );
    }

    console.log(
      JSON.stringify(
        {
          verify: {
            database: dbName,
            collection: collName,
            byKindInDb: verifyAgg,
          },
        },
        null,
        2,
      ),
    );

    if (inserted.length !== docs.length) {
      throw new Error(
        `insertMany: expected ${docs.length} documents, inserted ${inserted.length}`,
      );
    }

    await runPostSeedCatalogSmoke(docs.length);

    const refSeed = await seedReferenceDataCollections();

    console.log(
      JSON.stringify(
        {
          ok: true,
          input: docs.length,
          inserted: inserted.length,
          byKind: {
            boiler: docs.filter((d) => d.kind === 'boiler').length,
            radiator: docs.filter((d) => d.kind === 'radiator').length,
            waterHeater: docs.filter((d) => d.kind === 'waterHeater').length,
            pipe: docs.filter((d) => d.kind === 'pipe').length,
            indirectWaterHeater: docs.filter((d) => d.kind === 'indirectWaterHeater').length,
          },
          referenceData: refSeed,
        },
        null,
        2,
      ),
    );

    await tryInvalidateReferenceCacheRemote();
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
