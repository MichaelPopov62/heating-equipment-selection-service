/**
 * Назначение: расчётные формулы ГВС.
 * Описание: чистые функции тепловой мощности, объёма накопительного бака и времени нагрева;
 * все числовые нормы передаются из справочника water_norms.
 */

/**
 * @param {import('./types.js').NormalizedWaterNorms} norms
 * @param {number} flowLps
 * @param {number} deltaTK
 * @returns {number}
 */
export function hotWaterThermalPowerKw(norms, flowLps, deltaTK) {
  const q = Number(flowLps) || 0;
  const dt = Number(deltaTK) || 0;
  if (q <= 0 || dt <= 0) return 0;
  const { rhoKgPerL, cpKjPerKgK } = norms.physics;
  return q * rhoKgPerL * cpKjPerKgK * dt;
}

/**
 * Legacy-норма накопичувача: жильці × л/особу, мін. при ванні.
 * Множник tropicalShower застосовується в calculateHotWaterDemand
 * один раз до combinedRaw (max legacy/сеанс), не тут.
 *
 * @param {import('./types.js').NormalizedWaterNorms} norms
 * @param {number} residents
 * @param {number} bathCount
 * @returns {number}
 */
export function recommendedStorageTankLitersRaw(norms, residents, bathCount) {
  const { storage } = norms;
  const pop = Math.max(0, Math.trunc(Number(residents) || 0));
  const baths = Math.max(0, Math.trunc(Number(bathCount) || 0));
  let liters = pop * storage.litersPerResident;
  if (baths >= 1) {
    liters = Math.max(liters, storage.bathMinTankLiters);
  }
  return Math.ceil(liters);
}

/**
 * @param {import('./types.js').NormalizedWaterNorms} norms
 * @param {number} volumeLiters
 * @param {number} deltaTK
 * @param {number} [heatMinutes]
 */
export function tankVolumeHeatPowerKw(norms, volumeLiters, deltaTK, heatMinutes) {
  const V = Number(volumeLiters) || 0;
  const dt = Number(deltaTK) || 0;
  const tMin = Number(heatMinutes) || norms.storage.indirectHeatTimeMinutes;
  const tSec = Math.max(60, tMin * 60);
  if (V <= 0 || dt <= 0) return 0;
  const { rhoKgPerL, cpKjPerKgK } = norms.physics;
  return (V * rhoKgPerL * cpKjPerKgK * dt) / tSec;
}

/**
 * @param {import('./types.js').NormalizedWaterNorms} norms
 * @param {import('../types/shared-types.js').HotWaterFixturesInput | Record<string, number>} fixtures
 * @param {number} residents
 * @returns {number}
 */
export function estimatePeakSessionLitersMixed(norms, fixtures, residents) {
  const { session } = norms;
  const bath = Math.max(0, Math.trunc(Number(fixtures?.bath) || 0));
  const shower = Math.max(0, Math.trunc(Number(fixtures?.shower) || 0));
  const kitchenSink = Math.max(0, Math.trunc(Number(fixtures?.kitchenSink) || 0));
  const sink = Math.max(0, Math.trunc(Number(fixtures?.sink) || 0));
  const pop = Math.max(0, Math.min(20, Math.trunc(Number(residents) || 0)));

  let sessionLiters = 0;
  if (bath >= 1) sessionLiters += session.bathLiters;
  const div = session.showerUsesResidentsDivisor;
  const showerUses =
    shower <= 0 ? 0 : Math.min(shower, Math.max(1, Math.ceil(pop / div)));
  sessionLiters += showerUses * session.showerLiters;
  sessionLiters += Math.min(kitchenSink, session.kitchenSinkCap) * session.kitchenSinkLiters;
  sessionLiters += Math.min(sink, session.bathroomSinkCap) * session.bathroomSinkLiters;

  if (pop > 0 && sessionLiters < session.minMixedLiters) {
    sessionLiters = session.minMixedLiters;
  }
  return Math.ceil(sessionLiters);
}

/**
 * @param {import('./types.js').NormalizedWaterNorms} norms
 * @param {number} sessionLitersMixed
 */
export function equivalentStorageTankLitersFromSession(norms, sessionLitersMixed) {
  const L = Number(sessionLitersMixed) || 0;
  const k = norms.storage.volumeSubstitutionFactor;
  if (L <= 0 || k <= 0) return 0;
  return Math.ceil(L / k);
}

/**
 * @param {import('./types.js').NormalizedWaterNorms} norms
 * @param {number} volumeLiters
 * @param {number} deltaTK
 * @param {number} powerKw
 * @returns {number | null}
 */
function tankFullHeatTimeSeconds(norms, volumeLiters, deltaTK, powerKw) {
  const V = Number(volumeLiters) || 0;
  const dt = Number(deltaTK) || 0;
  const P = Number(powerKw) || 0;
  if (V <= 0 || dt <= 0 || P <= 0) return null;
  const { rhoKgPerL, cpKjPerKgK } = norms.physics;
  const energyKj = V * rhoKgPerL * cpKjPerKgK * dt;
  return energyKj / P;
}

/**
 * @param {import('./types.js').NormalizedWaterNorms} norms
 * @param {number} volumeLiters
 * @param {number} deltaTK
 * @param {number} powerKw
 * @returns {number | null}
 */
export function tankFullHeatTimeMinutes(norms, volumeLiters, deltaTK, powerKw) {
  const sec = tankFullHeatTimeSeconds(norms, volumeLiters, deltaTK, powerKw);
  return sec == null ? null : Number((sec / 60).toFixed(1));
}

/**
 * @param {import('./types.js').NormalizedWaterNorms} norms
 * @param {'house' | 'apartment'} objectType
 * @param {number} thermalFixtureCount
 * @param {number} residents
 */
export function simultaneityFactor(norms, objectType, thermalFixtureCount, residents) {
  const n = Math.max(0, thermalFixtureCount);
  if (n <= 0) return 1;
  if (n === 1) return 1;

  const ot = norms.objectTypes[objectType] ?? norms.objectTypes.house;
  const { simultaneity: sim } = norms;
  let beta = ot.simultaneityBase;
  const pop = Math.max(0, Math.min(20, Math.trunc(Number(residents) || 0)));
  beta *= 1 + Math.min(pop, sim.residentsFactorCap) * sim.residentsFactorPerPerson;
  beta *= 1 / (1 + sim.fixtureCountDivisor * Math.max(0, n - 1));
  return Math.min(sim.betaMax, Math.max(sim.betaMin, beta));
}
