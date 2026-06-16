/**
 * Назначение: заполнение справочных коллекций MongoDB из JSON-файлов.
 * Описание: Загружает water_norms, appliances и recommendations из backend/data/ с валидацией перед upsert.
 */

import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WaterNorms } from '../src/models/WaterNorms.js';
import { Appliance } from '../src/models/Appliance.js';
import { Recommendation } from '../src/models/Recommendation.js';
import { validateAndNormalizeWaterNorms } from '../src/dhw/validateWaterNorms.js';
import { validateAndNormalizeAppliancesBundle } from '../src/dhw/validateAppliances.js';
import { validateAndNormalizeRecommendationsBundle } from '../src/recommendations/validateRecommendations.js';
import { UnderfloorHeatingPreset } from '../src/models/UnderfloorHeatingPreset.js';
import { validateAndNormalizeUnderfloorHeatingPresets } from '../src/ufh/validateUnderfloorHeatingPresets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * @returns {Promise<{ waterNorms: number, appliances: number, recommendations: number, ufhPresets: number }>}
 */
export async function seedReferenceDataCollections() {
  const waterRaw = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, 'water_norms.json'), 'utf8'),
  );
  const appliancesRaw = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, 'appliances.json'), 'utf8'),
  );
  const recommendationsRaw = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, 'recommendations.json'), 'utf8'),
  );
  const ufhPresetsRaw = JSON.parse(
    await fs.readFile(path.join(DATA_DIR, 'underfloor_heating_presets.json'), 'utf8'),
  );

  const waterNorms = validateAndNormalizeWaterNorms(waterRaw);
  validateAndNormalizeAppliancesBundle(appliancesRaw, 'file');
  validateAndNormalizeRecommendationsBundle(recommendationsRaw, 'file');
  validateAndNormalizeUnderfloorHeatingPresets(ufhPresetsRaw);

  await WaterNorms.deleteMany({});
  await WaterNorms.create({
    ...waterRaw,
    schemaVersion: waterNorms.schemaVersion,
    isActive: true,
    label: waterNorms.label,
  });

  await Appliance.deleteMany({});
  const applianceDocs = appliancesRaw.map((/** @type {Record<string, unknown>} */ doc) => ({
    ...doc,
    isActive: doc.isActive !== false,
  }));
  await Appliance.insertMany(applianceDocs);

  await Recommendation.deleteMany({});
  const recommendationDocs = recommendationsRaw.map(
    (/** @type {Record<string, unknown>} */ doc) => ({
      ...doc,
      isActive: doc.isActive !== false,
    }),
  );
  await Recommendation.insertMany(recommendationDocs);

  await UnderfloorHeatingPreset.deleteMany({});
  const ufhPresetDocs = ufhPresetsRaw.map(
    (/** @type {Record<string, unknown>} */ doc) => ({
      ...doc,
      isActive: doc.isActive !== false,
    }),
  );
  await UnderfloorHeatingPreset.insertMany(ufhPresetDocs);

  return {
    waterNorms: 1,
    appliances: applianceDocs.length,
    recommendations: recommendationDocs.length,
    ufhPresets: ufhPresetDocs.length,
  };
}
