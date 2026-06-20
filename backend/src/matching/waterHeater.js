/**
 * Назначение: подбор электронакопительного водонагревателя.
 * Описание: выбор модели и варианта объёма из каталога по recommendedTankLiters; при нехватке
 * номенклатуры — максимально доступный вариант с предупреждением.
 */
import { buildMatchingSortPools } from '../catalog/matchingSortPools.js';
import { waterHeaterMaxVolumeLiters } from '../catalog/comparators.js';
import { logger } from '../utils/logger.js';

/**
 * Лучший вариант по потребности в литрах (минимальный объём среди ≥ need; иначе — максимальный у модели).
 * @param {import('../catalog/types').WaterHeaterCatalogItemNormalized} heater
 * @param {number} need
 */
function pickBestVariantForNeed(heater, need) {
  const variants = [...(heater.variants ?? [])].sort(
    (a, b) => a.volumeLiters - b.volumeLiters,
  );
  if (!variants.length) return null;
  if (need <= 0) return variants[0];
  const ok = variants.find((v) => v.volumeLiters >= need);
  return ok ?? variants[variants.length - 1];
}

/**
 * @param {object} args
 * @param {import('../types/shared-types').HotWaterReport} args.hotWater
 * @param {import('../catalog/types').NormalizedCatalog} args.catalog
 * @returns {import('../types/shared-types').WaterHeaterMatchingReport}
 */
export function pickWaterHeater({ hotWater, catalog } = {}) {
  const sortPools = buildMatchingSortPools(catalog);
  const heaters = sortPools.waterHeatersSortedByMinVolume ?? [];
  if (!heaters.length) {
    logger.warn('matching.waterHeater.emptyCatalog', null);
    return {
      selected: null,
      chosenVariant: null,
      warnings: ['В каталоге нет водонагревателей.'],
      requiredTankLiters: Number(hotWater?.recommendedTankLiters) || 0,
    };
  }

  const need = Number(hotWater?.recommendedTankLiters) || 0;
  logger.info('matching.waterHeater.start', null, { requiredTankLiters: need });

  /** @type {{ heater: import('../catalog/types').WaterHeaterCatalogItemNormalized; variant: import('../catalog/types').WaterHeaterVariantNormalized } | null} */
  let best = null;

  for (const h of heaters) {
    const maxCap = waterHeaterMaxVolumeLiters(h);
    if (need > 0 && maxCap < need) continue;

    const v = pickBestVariantForNeed(h, need);
    if (!v) continue;

    if (need > 0 && v.volumeLiters < need) continue;

    if (
      !best
      || v.volumeLiters < best.variant.volumeLiters
    ) {
      best = { heater: h, variant: v };
    }
  }

  const warnings = [];

  if (!best && heaters.length) {
    /** @type {{ heater: import('../catalog/types').WaterHeaterCatalogItemNormalized; variant: import('../catalog/types').WaterHeaterVariantNormalized } | null} */
    let largest = null;
    for (const h of heaters) {
      const vars = [...(h.variants ?? [])].sort(
        (a, b) => a.volumeLiters - b.volumeLiters,
      );
      const v = vars[vars.length - 1];
      if (
        !largest
        || v.volumeLiters > largest.variant.volumeLiters
      ) {
        largest = { heater: h, variant: v };
      }
    }
    best = largest;
    if (best && need > 0 && best.variant.volumeLiters < need) {
      warnings.push('Подобранный водонагреватель меньше расчётного объёма (ограничение каталога).');
    }
  }

  if (!best) {
    logger.info('matching.waterHeater.done', null, { selectedModel: null });
    return { selected: null, chosenVariant: null, warnings, requiredTankLiters: need };
  }

  /** @type {import('../types/shared-types').WaterHeaterChosenVariant} */
  const chosenVariant = {
    volumeLiters: best.variant.volumeLiters,
    price: best.variant.price,
    ...(best.variant.powerKw != null ? { powerKw: best.variant.powerKw } : {}),
    ...(best.variant.heatingTimeMinutes != null
      ? { heatingTimeMinutes: best.variant.heatingTimeMinutes }
      : {}),
  };

  logger.info('matching.waterHeater.done', null, {
    selectedModel: best.heater.model,
    chosenVolumeLiters: chosenVariant.volumeLiters,
    warnings: warnings.length,
  });

  return {
    selected: best.heater,
    chosenVariant,
    warnings,
    requiredTankLiters: need,
  };
}
