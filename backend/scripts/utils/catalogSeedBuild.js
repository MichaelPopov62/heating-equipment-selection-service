/**
 * Назначение: валидация и сборка документов коллекции products для seed.
 * Описание: Единая точка validateAndNormalizeCatalog + flatten в Mongo-документы.
 * Используется seed.js и verifySeedCatalog.js — контракт SSOT совпадает с loadCatalog().
 */
import { validateAndNormalizeCatalog } from './catalogNormalize.js';

/**
 * Глубокая копия для вставки в Mongo (без прототипов / циклов).
 *
 * @param {unknown} x
 * @returns {unknown}
 */
function cloneJsonSerializable(x) {
  return JSON.parse(JSON.stringify(x));
}

/**
 * Валидация JSON-каталога тем же контрактом, что и runtime loadCatalog().
 *
 * @param {unknown} parsed — распарсенный test_data.json
 * @returns {import('../../src/catalog/types').NormalizedCatalog}
 */
export function validateCatalogForSeed(parsed) {
  return validateAndNormalizeCatalog(parsed);
}

/**
 * Сводка по нормализованному каталогу (логи seed / verify).
 *
 * @param {import('../../src/catalog/types').NormalizedCatalog} norm
 * @returns {Record<string, number>}
 */
export function summarizeNormalizedCatalog(norm) {
  return {
    boilerDouble: norm.boilers.doubleCircuit.length,
    boilerSingle: norm.boilers.singleCircuit.length,
    radiators: norm.radiators.length,
    waterHeaters: norm.waterHeaters.length,
    pipes: (norm.pipes ?? []).length,
    indirectWaterHeaters: (norm.indirectWaterHeaters ?? []).length,
  };
}

/**
 * Плоские документы MongoDB products из уже провалидированного каталога.
 *
 * @param {import('../../src/catalog/types').NormalizedCatalog} norm
 * @returns {Record<string, unknown>[]}
 */
export function buildProductDocumentsFromNormalized(norm) {
  const boilers = [
    ...norm.boilers.doubleCircuit.map((x, i) => ({
      ...x,
      kind: 'boiler',
      catalogKey: `boiler-double-${i}`,
    })),
    ...norm.boilers.singleCircuit.map((x, i) => ({
      ...x,
      kind: 'boiler',
      catalogKey: `boiler-single-${i}`,
    })),
  ];

  const radiators = norm.radiators.map((x, i) => ({
    ...x,
    kind: 'radiator',
    catalogKey: `radiator-${i}`,
  }));

  const waterHeaters = norm.waterHeaters.map((x, i) => ({
    ...x,
    kind: 'waterHeater',
    catalogKey: `waterHeater-${i}`,
  }));

  const pipes = (norm.pipes ?? []).map((x, i) => {
    const raw = cloneJsonSerializable(x);
    const id = raw?.id != null ? String(raw.id).trim() : '';
    return {
      ...raw,
      kind: 'pipe',
      catalogKey: `pipe-${i}`,
      pipeId: id || undefined,
    };
  });

  const indirectWaterHeaters = (norm.indirectWaterHeaters ?? []).map((x, i) => ({
    ...cloneJsonSerializable(x),
    kind: 'indirectWaterHeater',
    catalogKey: `indirectWaterHeater-${i}`,
  }));

  return [...boilers, ...radiators, ...waterHeaters, ...pipes, ...indirectWaterHeaters];
}

/**
 * Валидация + сборка документов для seed (блокирует запись в Mongo при ошибке контракта).
 *
 * @param {unknown} parsed
 * @returns {{ normalized: import('../../src/catalog/types').NormalizedCatalog, docs: Record<string, unknown>[] }}
 */
export function validateAndBuildProductDocuments(parsed) {
  const normalized = validateCatalogForSeed(parsed);
  const docs = buildProductDocumentsFromNormalized(normalized);
  return { normalized, docs };
}
