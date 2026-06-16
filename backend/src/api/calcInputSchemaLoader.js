/**
 * Назначение: загрузчик JSON Schema для AJV.
 * Описание: Собирает components/schemas/CalcInput.yaml с $ref в единую схему для валидации анкеты; OpenAPI использует те же YAML-файлы. После bundle адаптирует enum и поля под runtime-нормализацию в validate.js. Экспортирует loadCalcInputSchemaForAjv().
 */

import $RefParser from '@apidevtools/json-schema-ref-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HOT_WATER_BOILER_MATCHING_SCHEME_ENUM,
} from '../../../shared/heatingMatchingSchemes.js';
import { CANONICAL_ROOM_TYPES } from '../../../shared/roomTypeNormalization.js';
import { UFH_MODE_PRESET_IDS } from '../../../shared/ufhModePresetIds.js';
import { HEATING_THERMAL_REGIME_PRESET_ENUM } from '../logic/heatingThermalRegimes.js';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** @type {import('ajv').SchemaObject | null} */
let cachedSchema = null;

/**
 * Правки после bundle: поведение runtime (нормализация типов комнат, enum из shared/*.js).
 *
 * @param {import('ajv').SchemaObject} schema
 */
function adaptBundledSchemaForAjv(schema) {
  const building = schema.properties?.building;
  const roomItems = building?.properties?.rooms?.items;
  if (roomItems?.properties?.type) {
    // До AJV тип комнаты нормализуется в validate.js; enum — CANONICAL_ROOM_TYPES.
    roomItems.properties.type = {
      type: 'string',
      enum: [...CANONICAL_ROOM_TYPES],
    };
  }

  const heating = schema.properties?.heatingSystem?.properties;
  if (heating?.hotWaterBoilerPowerMatchingScheme) {
    heating.hotWaterBoilerPowerMatchingScheme.enum = [...HOT_WATER_BOILER_MATCHING_SCHEME_ENUM];
  }
  if (heating?.thermalRegimePreset) {
    heating.thermalRegimePreset.enum = [...HEATING_THERMAL_REGIME_PRESET_ENUM];
  }
  if (heating?.ufhPresetId) {
    heating.ufhPresetId.enum = [...UFH_MODE_PRESET_IDS];
  }
}

/**
 * Собрать CalcInput из YAML-компонентов репозитория (кэш на процесс).
 *
 * @returns {Promise<import('ajv').SchemaObject>}
 */
export async function loadCalcInputSchemaForAjv() {
  if (cachedSchema) return cachedSchema;

  const calcInputPath = path.join(REPO_ROOT, 'components/schemas/CalcInput.yaml');

  /** @type {import('ajv').SchemaObject} */
  // Парсинг .yaml — встроенный js-yaml (зависимость ref-parser).
  const bundled = await $RefParser.bundle(calcInputPath);

  adaptBundledSchemaForAjv(bundled);
  cachedSchema = bundled;
  return bundled;
}
