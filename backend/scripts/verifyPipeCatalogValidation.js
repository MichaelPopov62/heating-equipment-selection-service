/**
 * Назначение: негативные и иммутабельность-проверки контракта pipes в validateAndNormalizeCatalog.
 * Описание: дополняет verify:seed-catalog (эталонный JSON); без MongoDB.
 */
import { validateAndNormalizeCatalog } from '../src/catalog/validateCatalog.js';
import { resolvePipeCatalogId } from '../src/catalog/pipeCatalogHelpers.js';

/**
 * Минимальный envelope каталога только с массивом pipes.
 *
 * @param {Record<string, unknown>[]} pipes
 * @returns {{
 *   schemaVersion: number;
 *   products: {
 *     boilers: { doubleCircuit: never[]; singleCircuit: never[] };
 *     radiators: never[];
 *     waterHeaters: never[];
 *     pipes: Record<string, unknown>[];
 *   };
 * }}
 */
function catalogEnvelopeWithPipes(pipes) {
  return {
    schemaVersion: 1,
    products: {
      boilers: { doubleCircuit: [], singleCircuit: [] },
      radiators: [],
      waterHeaters: [],
      pipes,
    },
  };
}

/** Эталонная строка трубы для позитивных кейсов. */
const VALID_PIPE = {
  id: 'pipe-verify-01',
  brand: 'TestBrand',
  material: 'PEX',
  diameter: 16,
  wallThickness: 2,
  price: 100,
};

/**
 * @param {() => void} fn
 * @param {string} label
 */
function expectThrow(fn, label) {
  try {
    fn();
    throw new Error(`verify:pipe-catalog: ожидалась ошибка — ${label}`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('verify:pipe-catalog: ожидалась ошибка')) {
      throw err;
    }
  }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// —— Иммутабельность входа (structuredClone) ——
const inputRoot = catalogEnvelopeWithPipes([{ ...VALID_PIPE, brand: '  SpacedBrand  ' }]);
const pipesSnapshot = JSON.stringify(inputRoot.products.pipes);
validateAndNormalizeCatalog(inputRoot);
const pipesAfter = JSON.stringify(inputRoot.products.pipes);
if (pipesAfter !== pipesSnapshot) {
  console.error('verify:pipe-catalog FAILED: validateAndNormalizeCatalog изменил входной JSON');
  process.exitCode = 1;
  process.exit(process.exitCode);
}

// —— Негативные кейсы ——
expectThrow(
  () => validateAndNormalizeCatalog(catalogEnvelopeWithPipes([{}])),
  'пустой объект pipe',
);

expectThrow(
  () =>
    validateAndNormalizeCatalog(
      catalogEnvelopeWithPipes([
        {
          id: 'pipe-missing-fields',
          brand: 'B',
          material: 'M',
        },
      ]),
    ),
  'нет diameter / wallThickness / price',
);

expectThrow(
  () =>
    validateAndNormalizeCatalog(
      catalogEnvelopeWithPipes([
        { ...VALID_PIPE, id: 'dup' },
        { ...VALID_PIPE, id: 'dup', diameter: 20 },
      ]),
    ),
  'дубликат id',
);

expectThrow(
  () =>
    validateAndNormalizeCatalog(
      catalogEnvelopeWithPipes([
        {
          ...VALID_PIPE,
          price: 0,
        },
      ]),
    ),
  'price = 0',
);

// —— Позитив: одна валидная труба ——
const normalized = validateAndNormalizeCatalog(catalogEnvelopeWithPipes([VALID_PIPE]));
const pipe = normalized.pipes?.[0];
if (!pipe) {
  console.error('verify:pipe-catalog FAILED: pipes[0] отсутствует после нормализации');
  process.exitCode = 1;
  process.exit(process.exitCode);
}

if (
  !isNonEmptyString(pipe.model)
  || !isNonEmptyString(pipe.id)
  || !isNonEmptyString(pipe.brand)
  || !isNonEmptyString(pipe.material)
  || typeof pipe.diameter !== 'number'
  || typeof pipe.wallThickness !== 'number'
  || typeof pipe.price !== 'number'
  || pipe.price < 1
) {
  console.error('verify:pipe-catalog FAILED: нормализованная труба не соответствует контракту');
  process.exitCode = 1;
  process.exit(process.exitCode);
}

process.stdout.write('verify:pipe-catalog OK — immutability + 4 negative + 1 positive\n');

// —— Round-trip Mongo: pipeId без корневого id (как после insertMany) ——
const mongoLike = {
  pipeId: 'p-mongo-roundtrip',
  brand: 'TestBrand',
  material: 'PEX',
  diameter: 16,
  wallThickness: 2,
  price: 100,
  model: 'p-mongo-roundtrip TestBrand PEX Ø16 ×2',
};
const catalogId = resolvePipeCatalogId(mongoLike);
if (catalogId !== 'p-mongo-roundtrip') {
  console.error('verify:pipe-catalog FAILED: resolvePipeCatalogId не взял pipeId');
  process.exitCode = 1;
  process.exit(process.exitCode);
}
const { pipeId: _pipeId, ...rowWithoutPipeId } = mongoLike;
const rowFromMongo = { ...rowWithoutPipeId, id: catalogId };
validateAndNormalizeCatalog(catalogEnvelopeWithPipes([rowFromMongo]));

process.stdout.write('verify:pipe-catalog OK — mongo pipeId → id round-trip\n');
