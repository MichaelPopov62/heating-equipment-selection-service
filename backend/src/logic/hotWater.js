/**
 * Назначение: расчёт горячего водоснабжения (ГВС).
 * Описание: По типу объекта (квартира/дом) и справочнику water_norms считает пиковую мощность, объём бака и параметры сеансов через dhw/waterCalc.js. Экспортирует calculateHotWaterDemand(); результат попадает в report.calculations.hotWater и matching.
 */

import {
  equivalentStorageTankLitersFromSession,
  estimatePeakSessionLitersMixed,
  hotWaterThermalPowerKw,
  recommendedStorageTankLitersRaw,
  simultaneityFactor,
  tankVolumeHeatPowerKw,
} from '../dhw/waterCalc.js';

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clampInteger(value, min, max) {
  const n = Number.isFinite(value) ? Math.trunc(value) : 0;
  return Math.max(min, Math.min(max, n));
}

/**
 * @param {import('../types/shared-types.js').HotWaterInput & { objectType?: string }} input
 * @param {import('../dhw/types.js').NormalizedWaterNorms} norms
 * @param {{ dhwSupplyScenarioOverride?: 'flowThrough' | 'storage' }} [options]
 * @returns {import('../types/shared-types.js').HotWaterReport}
 */
export function calculateHotWaterDemand(input = {}, norms, options = {}) {
  if (!norms) {
    throw new Error('calculateHotWaterDemand: не передан справочник water_norms');
  }

  const objectType =
    input.objectType === 'apartment' || input.objectType === 'house'
      ? input.objectType
      : 'house';

  const dhwSupplyScenario =
    options.dhwSupplyScenarioOverride ??
    norms.objectTypes[objectType]?.dhwSupplyScenario ??
    (objectType === 'apartment' ? 'flowThrough' : 'storage');

  const residents = clampInteger(input.residents ?? 0, 0, 20);

  const fx = input.fixtures ?? {};
  const fixtures = {
    shower: clampInteger(fx.shower ?? 0, 0, 30),
    bath: clampInteger(fx.bath ?? 0, 0, 30),
    sink: clampInteger(fx.sink ?? 0, 0, 30),
    toilet: clampInteger(fx.toilet ?? 0, 0, 30),
    kitchenSink: clampInteger(fx.kitchenSink ?? 0, 0, 30),
    dishwasher: clampInteger(fx.dishwasher ?? 0, 0, 30),
    laundrySink: clampInteger(fx.laundrySink ?? 0, 0, 30),
    washingMachine: clampInteger(fx.washingMachine ?? 0, 0, 30),
    bidet: clampInteger(fx.bidet ?? 0, 0, 30),
  };

  const tropicalShower = Boolean(input.tropicalShower);

  const coldWaterDesignSeason =
    input.coldWaterDesignSeason === 'summer' ? 'summer' : 'winter';
  const coldClamped =
    coldWaterDesignSeason === 'summer'
      ? norms.coldWaterDesignC.summer
      : norms.coldWaterDesignC.winter;

  const hotDefault = norms.hotWaterC.default;
  const hotWaterC = input.hotWaterC != null ? Number(input.hotWaterC) : hotDefault;
  const hotClamped = Math.max(
    norms.hotWaterC.min,
    Math.min(norms.hotWaterC.max, hotWaterC),
  );

  const deltaTK = Math.max(0, hotClamped - coldClamped);

  let sumFlowLpsRaw = 0;
  let thermalFixtureCount = 0;
  let maxSingleFlowLps = 0;

  const excludedForApartment = new Set(
    norms.hotThermalFixtureKeysExcludedForApartment ?? [],
  );
  const thermalKeys =
    objectType === 'apartment'
      ? norms.hotThermalFixtureKeys.filter((k) => !excludedForApartment.has(k))
      : norms.hotThermalFixtureKeys;

  for (const key of thermalKeys) {
    const count = fixtures[/** @type {keyof typeof fixtures} */ (key)] ?? 0;
    if (count <= 0) continue;
    const unitFlow = norms.fixtureHotFlowLps[key] ?? 0;
    if (unitFlow <= 0) continue;
    thermalFixtureCount += count;
    sumFlowLpsRaw += count * unitFlow;
    maxSingleFlowLps = Math.max(maxSingleFlowLps, unitFlow);
  }

  const beta = simultaneityFactor(
    norms,
    objectType,
    thermalFixtureCount,
    residents,
  );

  const reduced = sumFlowLpsRaw * beta;
  const peakFlowLps = Math.max(reduced, maxSingleFlowLps);

  const peakThermalPowerKw = Number(
    hotWaterThermalPowerKw(norms, peakFlowLps, deltaTK).toFixed(2),
  );

  const typicalTankSizes = norms.storage.typicalTankSizes;

  /** @type {number} */
  let recommendedTankLiters;
  /** @type {number | undefined} */
  let sessionDemandLitersMixed;
  /** @type {number | undefined} */
  let dhwEquivalentTankLitersFromSession;
  /** @type {number | undefined} */
  let dhwTankLitersCombinedRaw;

  if (dhwSupplyScenario === 'flowThrough') {
    recommendedTankLiters = 0;
  } else {
    const rawTankLegacy = recommendedStorageTankLitersRaw(
      norms,
      residents,
      fixtures.bath,
      tropicalShower,
    );
    sessionDemandLitersMixed = estimatePeakSessionLitersMixed(
      norms,
      fixtures,
      residents,
    );
    dhwEquivalentTankLitersFromSession = equivalentStorageTankLitersFromSession(
      norms,
      sessionDemandLitersMixed,
    );
    dhwTankLitersCombinedRaw = Math.max(
      rawTankLegacy,
      dhwEquivalentTankLitersFromSession,
    );

    const fallbackTank =
      typicalTankSizes[typicalTankSizes.length - 1];
    if (fallbackTank === undefined) {
      throw new Error('water_norms.storage.typicalTankSizes пуст');
    }
    const combinedRaw = dhwTankLitersCombinedRaw;
    if (combinedRaw === undefined) {
      throw new Error('hotWater: dhwTankLitersCombinedRaw не вычислен');
    }
    recommendedTankLiters =
      typicalTankSizes.find((t) => t >= combinedRaw) ??
      fallbackTank;
  }

  let hotWaterPowerKw;
  /** @type {number | undefined} */
  let storageHeatTimeMinutes;
  /** @type {number | undefined} */
  let storageIndirectHeatPowerKw;

  const heatMinutes = norms.storage.indirectHeatTimeMinutes;
  const dhwMinKw = norms.storage.boilerDhwPowerMinKw;

  if (dhwSupplyScenario === 'flowThrough') {
    hotWaterPowerKw = peakThermalPowerKw;
  } else {
    storageHeatTimeMinutes = heatMinutes;
    storageIndirectHeatPowerKw = Number(
      tankVolumeHeatPowerKw(norms, recommendedTankLiters, deltaTK, heatMinutes).toFixed(
        2,
      ),
    );
    hotWaterPowerKw = Number(
      Math.max(dhwMinKw, storageIndirectHeatPowerKw).toFixed(2),
    );
  }

  const objectNorms = norms.objectTypes[objectType] ?? norms.objectTypes.house;

  return {
    objectType,
    residents,
    fixtures,
    tropicalShower,
    coldWaterDesignSeason,
    dhwSupplyScenario,
    designColdWaterC: Number(coldClamped.toFixed(1)),
    hotWaterC: Number(hotClamped.toFixed(1)),
    deltaTK: Number(deltaTK.toFixed(1)),
    sumFlowLpsRaw: Number(sumFlowLpsRaw.toFixed(3)),
    simultaneityFactor: Number(beta.toFixed(3)),
    peakFlowLps: Number(peakFlowLps.toFixed(3)),
    peakThermalPowerKw,
    hotWaterPowerKw,
    recommendedTankLiters,
    normsSchemaVersion: norms.schemaVersion,
    ...(dhwSupplyScenario === 'storage'
      ? {
          storageTankLitersPerPersonBasis: norms.storage.litersPerResident,
          ...(storageHeatTimeMinutes !== undefined
            ? { storageHeatTimeMinutes }
            : {}),
          ...(storageIndirectHeatPowerKw !== undefined
            ? { storageIndirectHeatPowerKw }
            : {}),
          ...(sessionDemandLitersMixed !== undefined
            ? { sessionDemandLitersMixed }
            : {}),
          ...(dhwEquivalentTankLitersFromSession !== undefined
            ? { dhwEquivalentTankLitersFromSession }
            : {}),
          ...(dhwTankLitersCombinedRaw !== undefined
            ? { dhwTankLitersCombinedRaw }
            : {}),
        }
      : {}),
    simultaneityBaseNorm: objectNorms.simultaneityBase,
  };
}
