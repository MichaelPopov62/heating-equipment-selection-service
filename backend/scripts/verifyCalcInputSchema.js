/**
 * Назначение: проверка схемы входа расчёта CalcInput.
 * Описание: Сверяет enum room.type в OpenAPI с CANONICAL_ROOM_TYPES, собирает CalcInput.yaml
 * в JSON Schema, компилирует в AJV и валидирует тестовые payload (в т.ч. type=котельная).
 */
import Ajv from 'ajv';
import $RefParser from '@apidevtools/json-schema-ref-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_ROOM_TYPES } from '../../shared/roomTypeNormalization.js';
import { loadCalcInputSchemaForAjv } from '../src/api/calcInputSchemaLoader.js';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Сверка enum room.type в CalcInput.yaml с CANONICAL_ROOM_TYPES (двусторонняя).
 *
 * @returns {Promise<void>}
 */
async function verifyRoomTypesSync() {
  const calcInputPath = path.join(REPO_ROOT, 'components/schemas/CalcInput.yaml');
  const openApiSchema = await $RefParser.parse(calcInputPath);
  const openApiEnum = openApiSchema.properties?.building?.properties?.rooms?.items?.properties?.type
    ?.enum;

  if (!Array.isArray(openApiEnum) || openApiEnum.length === 0) {
    throw new Error('Не удалось найти enum building.rooms[].type в CalcInput.yaml');
  }

  const canonicalSet = new Set(CANONICAL_ROOM_TYPES);
  const openApiSet = new Set(openApiEnum);

  const missingInOpenApi = CANONICAL_ROOM_TYPES.filter((type) => !openApiSet.has(type));
  const missingInCanonical = openApiEnum.filter((type) => !canonicalSet.has(type));

  if (missingInOpenApi.length > 0 || missingInCanonical.length > 0) {
    console.error('ОШИБКА СИНХРОНИЗАЦИИ ТИПОВ КОМНАТ:');
    if (missingInOpenApi.length > 0) {
      console.error(
        `  В CalcInput.yaml (OpenAPI) не хватает типов: ${JSON.stringify(missingInOpenApi)}`,
      );
    }
    if (missingInCanonical.length > 0) {
      console.error(
        `  В CANONICAL_ROOM_TYPES не хватает типов из OpenAPI: ${JSON.stringify(missingInCanonical)}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    'Синхронизация room.type между OpenAPI и CANONICAL_ROOM_TYPES: OK\n',
  );
}

await verifyRoomTypesSync();
if (process.exitCode === 1) {
  process.exit(process.exitCode);
}

const ajv = new Ajv({ allErrors: true, coerceTypes: false, removeAdditional: true });
const schema = await loadCalcInputSchemaForAjv();
const validate = ajv.compile(schema);

const externalWalls = {
  presetId: 'wall_gas_concrete_d500',
  thicknessMm: 375,
  facadeSystem: 'none',
};

const minimal = {
  building: {
    temps: { insideC: 20, outsideC: -5 },
    objectMeta: {
      objectType: 'house',
      floors: 1,
      roomsCount: 1,
      externalWalls,
    },
    rooms: [
      {
        id: 'r1',
        name: 'Комната',
        type: 'гостиная',
        floor: 1,
        topBoundary: 'heated',
        bottomBoundary: 'unheated',
        areaM2: 10,
        heightM: 2.7,
      },
    ],
    envelopeElements: [
      {
        kind: 'wall',
        roomId: 'r1',
        construction: 'наружная стена',
        presetId: 'wall_gas_concrete_d500',
        areaM2: 12,
      },
    ],
  },
};

/** Дом с комнатой type=котельная (объём ≥ 7,5 м³ по appliances.boiler.mounting). */
const withBoilerRoom = {
  building: {
    temps: { insideC: 20, outsideC: -5 },
    objectMeta: {
      objectType: 'house',
      floors: 1,
      roomsCount: 2,
      boilerPlacementZone: 'boiler_room',
      externalWalls,
    },
    rooms: [
      {
        id: 'r1',
        name: 'Гостиная',
        type: 'гостиная',
        floor: 1,
        topBoundary: 'heated',
        bottomBoundary: 'unheated',
        areaM2: 10,
        heightM: 2.7,
      },
      {
        id: 'br1',
        name: 'Котельная',
        type: 'котельная',
        floor: 1,
        topBoundary: 'heated',
        bottomBoundary: 'unheated',
        areaM2: 4,
        heightM: 2.5,
      },
    ],
    envelopeElements: [
      {
        kind: 'wall',
        roomId: 'r1',
        construction: 'наружная стена',
        presetId: 'wall_gas_concrete_d500',
        areaM2: 12,
      },
    ],
  },
};

/** @param {string} label @param {unknown} payload */
function assertValidPayload(label, payload) {
  if (!validate(payload)) {
    console.error(`AJV validation failed (${label}):`);
    console.error(JSON.stringify(validate.errors, null, 2));
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`CalcInput schema: AJV OK (${label})\n`);
}

assertValidPayload('minimal', minimal);
assertValidPayload('withBoilerRoom', withBoilerRoom);

if (process.exitCode !== 1) {
  process.stdout.write('CalcInput schema: bundle + AJV compile OK\n');
}
