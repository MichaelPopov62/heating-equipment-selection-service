/**
 * Назначение: сборка CalcRuntimeContext из локальных JSON без MongoDB.
 * Описание: для verify-скриптов и unit-проверок validate/UFH без warmupReferenceCache.
 */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAndNormalizeCatalog } from '../../src/catalog/validateCatalog.js';
import { validateAndNormalizeWaterNorms } from '../../src/dhw/validateWaterNorms.js';
import { validateAndNormalizeAppliancesBundle } from '../../src/dhw/validateAppliances.js';
import { validateAndNormalizeRecommendationsBundle } from '../../src/recommendations/validateRecommendations.js';
import { validateAndNormalizeUnderfloorHeatingPresets } from '../../src/ufh/validateUnderfloorHeatingPresets.js';
import { toCalcRuntimeContext } from '../../src/reference/toCalcRuntimeContext.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', '..', 'data');
const catalogExample = path.join(__dirname, '..', '..', 'test_data.json.example');

/**
 * @param {string} filePath
 * @returns {Promise<unknown>}
 */
async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

/**
 * Загружает согласованный CalcRuntimeContext из файлов backend/data и test_data.json.example.
 *
 * @returns {Promise<import('../../src/types/shared-types.js').CalcRuntimeContext>}
 */
export async function loadCalcRuntimeContextFromFiles() {
  const [
    catalogEnvelope,
    waterNormsRaw,
    appliancesRaw,
    recommendationsRaw,
    ufhPresetsRaw,
  ] = await Promise.all([
    readJsonFile(catalogExample),
    readJsonFile(path.join(dataDir, 'water_norms.json')),
    readJsonFile(path.join(dataDir, 'appliances.json')),
    readJsonFile(path.join(dataDir, 'recommendations.json')),
    readJsonFile(path.join(dataDir, 'underfloor_heating_presets.json')),
  ]);

  const catalog = validateAndNormalizeCatalog(catalogEnvelope);
  const waterNorms = validateAndNormalizeWaterNorms(waterNormsRaw);
  const appliances = validateAndNormalizeAppliancesBundle(appliancesRaw, 'file');
  const recommendations = validateAndNormalizeRecommendationsBundle(recommendationsRaw);
  const ufhPresets = validateAndNormalizeUnderfloorHeatingPresets(ufhPresetsRaw);

  return toCalcRuntimeContext({
    catalog,
    catalogSource: 'file',
    waterNorms,
    waterNormsSource: 'file',
    appliances,
    appliancesSource: 'file',
    recommendations,
    recommendationsSource: 'file',
    ufhPresets,
    ufhPresetsSource: 'file',
    loadedAt: Date.now(),
  });
}
