/**
 * Назначение: критерии классификации квартиры и вспомогательные расчёты для подбора котла.
 * Описание: Пороговые значения из appliances.boiler.apartmentClassification; площадь, санузлы, схемы ГВС.
 */

import { resolveObjectType } from './boilerMountingConstraints.js';

/**
 * @param {import('../dhw/types.js').BoilerApplianceRules['apartmentClassification'] | undefined} classification
 * @returns {import('../dhw/types.js').BoilerApplianceRules['apartmentClassification']}
 */
function resolveApartmentClassification(classification) {
  if (classification) return classification;
  throw new Error(
    'apartmentMatching: apartmentClassification обязателен (передайте appliances.byKind.boiler.apartmentClassification из CalcRuntimeContext).',
  );
}

/**
 * Суммарная площадь помещений, м².
 * @param {import('../types/shared-types.js').BuildingInput | undefined} building
 */
export function sumRoomsAreaM2(building) {
  const rooms = building?.rooms;
  if (!Array.isArray(rooms)) return 0;
  return rooms.reduce((s, r) => s + (Number(r?.areaM2) || 0), 0);
}

/**
 * Число санузлов: комнаты type=bathroom/санузел или точки bath+shower ≥ порога.
 * @param {import('../types/shared-types.js').BuildingInput | undefined} building
 * @param {import('../types/shared-types.js').HotWaterFixturesInput | undefined} fixtures
 */
export function countApartmentBathrooms(building, fixtures) {
  const rooms = building?.rooms ?? [];
  let fromRooms = 0;
  for (const r of rooms) {
    const t = String(r?.type ?? '').trim().toLowerCase();
    if (
      t === 'bathroom' ||
      t === 'санузел' ||
      t.includes('сануз') ||
      t.includes('bathroom')
    ) {
      fromRooms += 1;
    }
  }
  const fx = fixtures ?? {};
  const fromFixtures =
    (Number(fx.bath) || 0) + (Number(fx.shower) || 0);
  return Math.max(fromRooms, fromFixtures);
}

/**
 * «Большая квартира» по данным анкеты (до расчёта теплопотерь).
 * @param {import('../types/shared-types.js').BuildingInput | undefined} building
 * @param {import('../types/shared-types.js').HotWaterFixturesInput | undefined} fixtures
 * @param {import('../dhw/types.js').BoilerApplianceRules['apartmentClassification']} apartmentClassification
 */
export function isLargeApartmentByInput(building, fixtures, apartmentClassification) {
  const objectMeta = building?.objectMeta;
  if (resolveObjectType(objectMeta) !== 'apartment') return false;
  const rules = resolveApartmentClassification(apartmentClassification);
  const area = sumRoomsAreaM2(building);
  const bathrooms = countApartmentBathrooms(building, fixtures);
  return (
    area > rules.largeAreaM2Min ||
    bathrooms >= rules.minBathroomsForLargeApartment
  );
}

/**
 * «Большая квартира» с учётом расчётной отопительной нагрузки, кВт (после heatLoss).
 * @param {import('../types/shared-types.js').BuildingInput | undefined} building
 * @param {number} heatingLoadKw отопление × запас
 * @param {import('../types/shared-types.js').HotWaterFixturesInput | undefined} fixtures
 * @param {import('../dhw/types.js').BoilerApplianceRules['apartmentClassification']} apartmentClassification
 */
export function isLargeApartment(
  building,
  heatingLoadKw,
  fixtures,
  apartmentClassification,
) {
  if (isLargeApartmentByInput(building, fixtures, apartmentClassification)) return true;
  const objectMeta = building?.objectMeta;
  if (resolveObjectType(objectMeta) !== 'apartment') return false;
  const rules = resolveApartmentClassification(apartmentClassification);
  return Number(heatingLoadKw) > rules.largeHeatingLoadKwMin;
}

/**
 * Округлення потреби в літрах до типорозміру бака; опційно +tropicalShower.
 * @param {import('../dhw/types.js').NormalizedWaterNorms} norms
 * @param {number} needLiters
 * @param {boolean} [tropicalShower]
 * @returns {number}
 */
function snapTankLitersWithTropical(norms, needLiters, tropicalShower = false) {
  let need = Math.max(0, Math.ceil(Number(needLiters) || 0));
  if (tropicalShower) {
    need = Math.ceil(need * norms.storage.tropicalShowerVolumeFactor);
  }
  const sizes = norms.storage.typicalTankSizes;
  const fallback = sizes[sizes.length - 1];
  if (fallback === undefined) {
    throw new Error('water_norms.storage.typicalTankSizes пуст');
  }
  return sizes.find((t) => t >= need) ?? fallback;
}

/**
 * Объём электробойлера для квартиры (л) по норме apartmentElectricStorage.
 * @param {import('../dhw/types.js').NormalizedWaterNorms} norms
 * @param {number} residents
 * @param {boolean} [tropicalShower]
 */
export function recommendedApartmentElectricTankLiters(
  norms,
  residents,
  tropicalShower = false,
) {
  const aes = norms.apartmentElectricStorage;
  const pop = Math.max(0, Math.trunc(Number(residents) || 0));
  const raw = pop * aes.litersPerResident;
  const need = Math.max(aes.minTankLiters, Math.ceil(raw));
  return snapTankLitersWithTropical(norms, need, tropicalShower);
}

/**
 * Объём буферного электробойлера для схемы 2К + буфер (л) по норме combiBufferElectricStorage.
 * @param {import('../dhw/types.js').NormalizedWaterNorms} norms
 * @param {number} residents
 * @param {boolean} [tropicalShower]
 */
export function recommendedCombiBufferTankLiters(
  norms,
  residents,
  tropicalShower = false,
) {
  const cfg = norms.combiBufferElectricStorage;
  const pop = Math.max(0, Math.trunc(Number(residents) || 0));
  const raw = pop * cfg.litersPerResident;
  const need = Math.max(cfg.minTankLiters, Math.ceil(raw));
  return snapTankLitersWithTropical(norms, need, tropicalShower);
}

/**
 * Объём буферного электробойлера для схемы 1К + буфер (л) по норме singleCircuitBufferElectricStorage.
 * @param {import('../dhw/types.js').NormalizedWaterNorms} norms
 * @param {number} residents
 * @param {boolean} [tropicalShower]
 */
export function recommendedSingleCircuitBufferTankLiters(
  norms,
  residents,
  tropicalShower = false,
) {
  const cfg = norms.singleCircuitBufferElectricStorage;
  const pop = Math.max(0, Math.trunc(Number(residents) || 0));
  const raw = pop * cfg.litersPerResident;
  const need = Math.max(cfg.minTankLiters, Math.ceil(raw));
  return snapTankLitersWithTropical(norms, need, tropicalShower);
}

/**
 * Минимальный powerKw.max среди одноконтурных котлов пула.
 * @param {import('../catalog/types.js').BoilerCatalogItemNormalized[]} boilers
 */
export function smallestSingleCircuitMaxKw(boilers) {
  if (!boilers?.length) return null;
  let min = Infinity;
  for (const b of boilers) {
    const max = Number(b?.powerKw?.max);
    if (Number.isFinite(max) && max > 0 && max < min) min = max;
  }
  return Number.isFinite(min) ? min : null;
}
