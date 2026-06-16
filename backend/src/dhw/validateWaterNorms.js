/**
 * Назначение: валидация справочника water_norms.
 * Описание: проверка и нормализация норм ГВС (расходы, сеансы, storage, simultaneity);
 * единственный источник чисел — JSON/Mongo, без запасных констант в коде.
 */
import {
  requireEnum,
  requireFiniteNum,
  requireObject,
  requirePosNum,
} from './validateReferenceHelpers.js';

/** @param {unknown} raw */
function normObjectTypes(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('water_norms.objectTypes: ожидается объект');
  }
  const o = /** @type {Record<string, unknown>} */ (raw);
  /** @type {'house' | 'apartment'} */
  const keys = ['house', 'apartment'];
  /** @type {import('./types').NormalizedWaterNorms['objectTypes']} */
  const out = /** @type {import('./types').NormalizedWaterNorms['objectTypes']} */ ({});
  for (const key of keys) {
    const rec = requireObject(o, key, `water_norms.objectTypes.${key}`);
    const base = requirePosNum(rec, 'simultaneityBase', `water_norms.objectTypes.${key}`);
    const scenario = requireEnum(
      rec,
      'dhwSupplyScenario',
      ['flowThrough', 'storage'],
      `water_norms.objectTypes.${key}`,
    );
    out[key] = {
      simultaneityBase: base,
      dhwSupplyScenario: /** @type {'storage' | 'flowThrough'} */ (scenario),
    };
  }
  return out;
}

/**
 * @param {unknown} json
 * @returns {import('./types').NormalizedWaterNorms}
 */
export function validateAndNormalizeWaterNorms(json) {
  if (!json || typeof json !== 'object') {
    throw new Error('water_norms: ожидается объект');
  }
  const root = /** @type {Record<string, unknown>} */ (json);
  const schemaVersionRaw = Number(root.schemaVersion);
  if (!Number.isFinite(schemaVersionRaw) || Math.trunc(schemaVersionRaw) < 1) {
    throw new Error('water_norms.schemaVersion: обязательное целое >= 1');
  }
  const schemaVersion = Math.trunc(schemaVersionRaw);
  const label = root.label != null ? String(root.label).trim() : '';
  if (!label) {
    throw new Error('water_norms.label: обязательная непустая строка');
  }

  const objectTypes = normObjectTypes(root.objectTypes ?? null);
  const sim = requireObject(root, 'simultaneity', 'water_norms.simultaneity');

  const fixtureRaw = requireObject(root, 'fixtureHotFlowLps', 'water_norms.fixtureHotFlowLps');
  /** @type {Record<string, number>} */
  const fixtureHotFlowLps = {};
  for (const [k, v] of Object.entries(fixtureRaw)) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`water_norms.fixtureHotFlowLps.${k}: ожидается число >= 0`);
    }
    fixtureHotFlowLps[k] = n;
  }

  const keysRaw = root.hotThermalFixtureKeys;
  if (!Array.isArray(keysRaw) || keysRaw.length === 0) {
    throw new Error('water_norms.hotThermalFixtureKeys: обязательный непустой массив');
  }
  const hotThermalFixtureKeys = keysRaw.map((k) => String(k).trim()).filter(Boolean);
  if (hotThermalFixtureKeys.length !== keysRaw.length) {
    throw new Error('water_norms.hotThermalFixtureKeys: пустые ключи приборов недопустимы');
  }

  const excludedRaw = root.hotThermalFixtureKeysExcludedForApartment;
  if (!Array.isArray(excludedRaw)) {
    throw new Error(
      'water_norms.hotThermalFixtureKeysExcludedForApartment: обязательный массив строк',
    );
  }
  const hotThermalFixtureKeysExcludedForApartment = excludedRaw
    .map((k) => String(k).trim())
    .filter(Boolean);
  for (const k of hotThermalFixtureKeysExcludedForApartment) {
    if (!(k in fixtureHotFlowLps)) {
      throw new Error(
        `water_norms.hotThermalFixtureKeysExcludedForApartment: неизвестный прибор "${k}"`,
      );
    }
  }

  const cold = requireObject(root, 'coldWaterDesignC', 'water_norms.coldWaterDesignC');
  const hw = requireObject(root, 'hotWaterC', 'water_norms.hotWaterC');
  const st = requireObject(root, 'storage', 'water_norms.storage');
  const aes = requireObject(root, 'apartmentElectricStorage', 'water_norms.apartmentElectricStorage');
  const cbe = requireObject(root, 'combiBufferElectricStorage', 'water_norms.combiBufferElectricStorage');
  const scbe = requireObject(
    root,
    'singleCircuitBufferElectricStorage',
    'water_norms.singleCircuitBufferElectricStorage',
  );
  const ses = requireObject(root, 'session', 'water_norms.session');
  const ph = requireObject(root, 'physics', 'water_norms.physics');

  const typicalRaw = st.typicalTankSizes;
  if (!Array.isArray(typicalRaw) || typicalRaw.length === 0) {
    throw new Error('water_norms.storage.typicalTankSizes: обязательный непустой массив');
  }
  const typicalTankSizes = typicalRaw.map((x, i) => {
    const n = Math.trunc(Number(x));
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`water_norms.storage.typicalTankSizes[${i}]: ожидается целое > 0`);
    }
    return n;
  });

  const betaMin = requireFiniteNum(sim, 'betaMin', 'water_norms.simultaneity');
  const betaMax = requireFiniteNum(sim, 'betaMax', 'water_norms.simultaneity');
  if (betaMin > betaMax) {
    throw new Error('water_norms.simultaneity: betaMin не может быть больше betaMax');
  }

  const hwMin = requireFiniteNum(hw, 'min', 'water_norms.hotWaterC');
  const hwMax = requireFiniteNum(hw, 'max', 'water_norms.hotWaterC');
  const hwDefault = requireFiniteNum(hw, 'default', 'water_norms.hotWaterC');
  if (hwMin > hwMax || hwDefault < hwMin || hwDefault > hwMax) {
    throw new Error('water_norms.hotWaterC: min <= default <= max');
  }

  return {
    schemaVersion,
    label,
    objectTypes,
    simultaneity: {
      residentsFactorPerPerson: requirePosNum(
        sim,
        'residentsFactorPerPerson',
        'water_norms.simultaneity',
      ),
      residentsFactorCap: Math.max(
        1,
        Math.trunc(requireFiniteNum(sim, 'residentsFactorCap', 'water_norms.simultaneity')),
      ),
      fixtureCountDivisor: requirePosNum(sim, 'fixtureCountDivisor', 'water_norms.simultaneity'),
      betaMin,
      betaMax,
    },
    fixtureHotFlowLps,
    hotThermalFixtureKeys,
    hotThermalFixtureKeysExcludedForApartment,
    coldWaterDesignC: {
      winter: requireFiniteNum(cold, 'winter', 'water_norms.coldWaterDesignC'),
      summer: requireFiniteNum(cold, 'summer', 'water_norms.coldWaterDesignC'),
    },
    hotWaterC: {
      min: hwMin,
      max: hwMax,
      default: hwDefault,
    },
    apartmentElectricStorage: {
      litersPerResident: requirePosNum(
        aes,
        'litersPerResident',
        'water_norms.apartmentElectricStorage',
      ),
      minTankLiters: requirePosNum(
        aes,
        'minTankLiters',
        'water_norms.apartmentElectricStorage',
      ),
    },
    combiBufferElectricStorage: {
      litersPerResident: requirePosNum(
        cbe,
        'litersPerResident',
        'water_norms.combiBufferElectricStorage',
      ),
      minTankLiters: requirePosNum(
        cbe,
        'minTankLiters',
        'water_norms.combiBufferElectricStorage',
      ),
    },
    singleCircuitBufferElectricStorage: {
      litersPerResident: requirePosNum(
        scbe,
        'litersPerResident',
        'water_norms.singleCircuitBufferElectricStorage',
      ),
      minTankLiters: requirePosNum(
        scbe,
        'minTankLiters',
        'water_norms.singleCircuitBufferElectricStorage',
      ),
    },
    storage: {
      litersPerResident: requirePosNum(st, 'litersPerResident', 'water_norms.storage'),
      bathMinTankLiters: requirePosNum(st, 'bathMinTankLiters', 'water_norms.storage'),
      tropicalShowerVolumeFactor: requirePosNum(
        st,
        'tropicalShowerVolumeFactor',
        'water_norms.storage',
      ),
      indirectHeatTimeMinutes: requirePosNum(
        st,
        'indirectHeatTimeMinutes',
        'water_norms.storage',
      ),
      boilerDhwPowerMinKw: requirePosNum(st, 'boilerDhwPowerMinKw', 'water_norms.storage'),
      volumeSubstitutionFactor: requirePosNum(
        st,
        'volumeSubstitutionFactor',
        'water_norms.storage',
      ),
      typicalTankSizes,
    },
    session: {
      bathLiters: requirePosNum(ses, 'bathLiters', 'water_norms.session'),
      showerLiters: requirePosNum(ses, 'showerLiters', 'water_norms.session'),
      kitchenSinkLiters: requirePosNum(ses, 'kitchenSinkLiters', 'water_norms.session'),
      bathroomSinkLiters: requirePosNum(ses, 'bathroomSinkLiters', 'water_norms.session'),
      minMixedLiters: requirePosNum(ses, 'minMixedLiters', 'water_norms.session'),
      kitchenSinkCap: Math.max(
        0,
        Math.trunc(requireFiniteNum(ses, 'kitchenSinkCap', 'water_norms.session')),
      ),
      bathroomSinkCap: Math.max(
        0,
        Math.trunc(requireFiniteNum(ses, 'bathroomSinkCap', 'water_norms.session')),
      ),
      showerUsesResidentsDivisor: Math.max(
        1,
        Math.trunc(
          requireFiniteNum(ses, 'showerUsesResidentsDivisor', 'water_norms.session'),
        ),
      ),
    },
    physics: {
      cpKjPerKgK: requirePosNum(ph, 'cpKjPerKgK', 'water_norms.physics'),
      rhoKgPerL: requirePosNum(ph, 'rhoKgPerL', 'water_norms.physics'),
    },
  };
}
