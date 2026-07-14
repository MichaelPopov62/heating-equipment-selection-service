/**
 * Назначение: проверка схемы входа расчёта CalcInput.
 * Описание: Сверяет enum room.type в OpenAPI с CANONICAL_ROOM_TYPES, собирает CalcInput.yaml
 * в JSON Schema, компилирует в AJV и валидирует тестовые payload (в т.ч. type=котельная).
 */
import AjvModule from 'ajv';
import $RefParser from '@apidevtools/json-schema-ref-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_ROOM_TYPES } from '../../shared/roomTypeNormalization.js';
import { loadCalcInputSchemaForAjv } from '../src/api/calcInputSchemaLoader.js';
import { buildObjectMeta, buildRoom } from './fixtures/verifyFixtures.js';

const AjvCtor = /** @type {typeof import('ajv').default} */ (/** @type {unknown} */ (AjvModule));

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Извлекает enum building.rooms[].type из развёрнутой OpenAPI-схемы.
 *
 * @param {unknown} schema
 * @returns {string[] | undefined}
 */
function extractRoomTypeEnum(schema) {
  if (typeof schema !== 'object' || schema === null) return undefined;
  const root = /** @type {Record<string, unknown>} */ (schema);
  const properties = /** @type {Record<string, unknown>} */ (root.properties ?? {});
  const building = /** @type {Record<string, unknown>} */ (properties.building ?? {});
  const buildingProps = /** @type {Record<string, unknown>} */ (building.properties ?? {});
  const rooms = /** @type {Record<string, unknown>} */ (buildingProps.rooms ?? {});
  const items = /** @type {Record<string, unknown>} */ (rooms.items ?? {});
  const itemProps = /** @type {Record<string, unknown>} */ (items.properties ?? {});
  const typeField = /** @type {Record<string, unknown>} */ (itemProps.type ?? {});
  const enumVal = typeField.enum;
  if (!Array.isArray(enumVal)) return undefined;
  return enumVal.filter((value) => typeof value === 'string');
}

/**
 * Сверка enum room.type в CalcInput.yaml с CANONICAL_ROOM_TYPES (двусторонняя).
 *
 * @returns {Promise<void>}
 */
async function verifyRoomTypesSync() {
  const calcInputPath = path.join(REPO_ROOT, 'components/schemas/CalcInput.yaml');
  const parsed = await $RefParser.parse(calcInputPath);
  const openApiEnum = extractRoomTypeEnum(parsed);

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

const ajv = new AjvCtor({ allErrors: true, coerceTypes: false, removeAdditional: true });
const schema = await loadCalcInputSchemaForAjv();
const validate = ajv.compile(schema);

const minimal = {
  building: {
    temps: { insideC: 20, outsideC: -5 },
    objectMeta: buildObjectMeta({ objectType: 'house' }),
    rooms: [
      buildRoom({
        id: 'r1',
        name: 'Комната',
        areaM2: 10,
      }),
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
    objectMeta: buildObjectMeta({
      objectType: 'house',
      roomsCount: 2,
      boilerPlacementZone: 'boiler_room',
    }),
    rooms: [
      buildRoom({
        id: 'r1',
        name: 'Гостиная',
        areaM2: 10,
      }),
      buildRoom({
        id: 'br1',
        name: 'Котельная',
        type: 'котельная',
        areaM2: 4,
        heightM: 2.5,
      }),
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
