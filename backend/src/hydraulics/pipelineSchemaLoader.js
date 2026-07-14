/**
 * Назначение: загрузчик JSON Schema HydraulicsPipelineInput для AJV.
 * Описание: Bundle YAML из components/schemas/.
 */

import $RefParser from '@apidevtools/json-schema-ref-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** @type {import('ajv').SchemaObject | null} */
let cachedSchema = null;

/**
 * @returns {Promise<import('ajv').SchemaObject>}
 */
export async function loadHydraulicsPipelineSchemaForAjv() {
  if (cachedSchema) return cachedSchema;
  const schemaPath = path.join(
    REPO_ROOT,
    'components/schemas/HydraulicsPipelineInput.yaml',
  );
  cachedSchema = /** @type {import('ajv').SchemaObject} */ (
    await $RefParser.dereference(schemaPath)
  );
  return cachedSchema;
}

/**
 * @param {import('ajv').SchemaObject | null} [schema]
 */
export function resetHydraulicsPipelineSchemaCacheForTests(schema = null) {
  cachedSchema = schema;
}
