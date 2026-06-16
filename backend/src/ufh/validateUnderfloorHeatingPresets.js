/**
 * Назначение: валидация и нормализация underfloor_heating_presets.
 * Описание: Проверка документов из Mongo/file; derive supplyC/returnC (Δt=10 K).
 */
import { UFH_MODE_PRESET_IDS, isUfhModePresetId } from '../../../shared/ufhModePresetIds.js';

const UFH_CIRCUIT_DELTA_T_K = 10;

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {number}
 */
function requireFiniteNum(value, path) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`${path}: ожидается число`);
  }
  return n;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {boolean}
 */
function requireBoolean(value, path) {
  if (typeof value !== 'boolean') {
    throw new Error(`${path}: ожидается boolean`);
  }
  return value;
}

/**
 * @param {unknown} value
 * @param {string} path
 * @returns {string}
 */
function requireNonEmptyString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${path}: ожидается непустая строка`);
  }
  return value.trim();
}

/**
 * @param {Record<string, unknown>} raw
 * @returns {import('./types').NormalizedUfhModePreset}
 */
function normalizeOnePreset(raw) {
  const presetId = requireNonEmptyString(raw.presetId, 'underfloor_heating_presets.presetId');
  if (!isUfhModePresetId(presetId)) {
    throw new Error(`underfloor_heating_presets: неизвестный presetId "${presetId}"`);
  }

  const technicalRaw = raw.technical;
  if (!technicalRaw || typeof technicalRaw !== 'object') {
    throw new Error(`underfloor_heating_presets[${presetId}].technical: обязателен`);
  }
  /** @type {Record<string, unknown>} */
  const tech = /** @type {Record<string, unknown>} */ (technicalRaw);

  const maxSupplyTemperatureC = requireFiniteNum(
    tech.maxSupplyTemperatureC,
    `underfloor_heating_presets[${presetId}].technical.maxSupplyTemperatureC`,
  );
  const maxSurfaceTemperatureC = requireFiniteNum(
    tech.maxSurfaceTemperatureC,
    `underfloor_heating_presets[${presetId}].technical.maxSurfaceTemperatureC`,
  );
  const hasMixingNode = requireBoolean(
    tech.hasMixingNode,
    `underfloor_heating_presets[${presetId}].technical.hasMixingNode`,
  );
  const requiresCondensingBoiler = requireBoolean(
    tech.requiresCondensingBoiler,
    `underfloor_heating_presets[${presetId}].technical.requiresCondensingBoiler`,
  );

  const supplyC = maxSupplyTemperatureC;
  const returnC = supplyC - UFH_CIRCUIT_DELTA_T_K;

  const uiRaw = raw.ui;
  if (!uiRaw || typeof uiRaw !== 'object') {
    throw new Error(`underfloor_heating_presets[${presetId}].ui: обязателен`);
  }
  /** @type {Record<string, unknown>} */
  const uiObj = /** @type {Record<string, unknown>} */ (uiRaw);

  return {
    presetId,
    technical: {
      hasMixingNode,
      requiresCondensingBoiler,
      maxSupplyTemperatureC,
      maxSurfaceTemperatureC,
      supplyC,
      returnC,
    },
    ui: {
      title: requireNonEmptyString(uiObj.title, `underfloor_heating_presets[${presetId}].ui.title`),
      badge: requireNonEmptyString(uiObj.badge, `underfloor_heating_presets[${presetId}].ui.badge`),
      description: requireNonEmptyString(
        uiObj.description,
        `underfloor_heating_presets[${presetId}].ui.description`,
      ),
    },
  };
}

/**
 * @param {unknown} json — массив документов или один bundle-объект
 * @returns {import('./types').UnderfloorHeatingPresetsBundle}
 */
export function validateAndNormalizeUnderfloorHeatingPresets(json) {
  /** @type {unknown[]} */
  let docs;
  if (Array.isArray(json)) {
    docs = json;
  } else if (json && typeof json === 'object' && Array.isArray(/** @type {{ presets?: unknown[] }} */ (json).presets)) {
    docs = /** @type {{ presets: unknown[] }} */ (json).presets;
  } else {
    throw new Error('underfloor_heating_presets: ожидается массив документов');
  }

  const activeDocs = docs.filter((d) => {
    if (!d || typeof d !== 'object') return false;
    return /** @type {{ isActive?: boolean }} */ (d).isActive !== false;
  });

  /** @type {import('./types').NormalizedUfhModePreset[]} */
  const presets = [];
  /** @type {Record<string, import('./types').NormalizedUfhModePreset>} */
  const byPresetId = {};

  for (const doc of activeDocs) {
    const normalized = normalizeOnePreset(/** @type {Record<string, unknown>} */ (doc));
    if (byPresetId[normalized.presetId]) {
      throw new Error(`underfloor_heating_presets: дубликат presetId "${normalized.presetId}"`);
    }
    presets.push(normalized);
    byPresetId[normalized.presetId] = normalized;
  }

  for (const id of UFH_MODE_PRESET_IDS) {
    if (!byPresetId[id]) {
      throw new Error(`underfloor_heating_presets: отсутствует обязательный presetId "${id}"`);
    }
  }

  const schemaVersion =
    activeDocs[0] &&
    typeof activeDocs[0] === 'object' &&
    /** @type {{ meta?: { schemaVersion?: number } }} */ (activeDocs[0]).meta?.schemaVersion != null
      ? Math.trunc(
          Number(/** @type {{ meta: { schemaVersion: number } }} */ (activeDocs[0]).meta.schemaVersion),
        )
      : 1;

  return {
    schemaVersion: Number.isFinite(schemaVersion) && schemaVersion > 0 ? schemaVersion : 1,
    presets,
    byPresetId,
  };
}
