/**
 * Назначение: подбор БКН и связка с котлом.
 * Описание: выбор бойлера косвенного нагрева из каталога, пересчёт блока ГВС по фактическому объёму
 * бака, уточнение requiredKw котла и предупреждения по мощности змеевика и времени нагрева.
 */
import { tankFullHeatTimeMinutes, tankVolumeHeatPowerKw } from '../dhw/waterCalc.js';
import { getAppliances } from '../dhw/referenceCache.js';
import { getWaterNorms } from '../dhw/referenceCache.js';
import { pushRecommendation } from '../recommendations/recommendationResolver.js';
import { logger } from '../utils/logger.js';
import {
  indirectCoilPowerKw,
  indirectMinSourcePowerKw,
  indirectTankVolumeLiters,
} from './internal/indirectCatalogHelpers.js';

/**
 * Пересчёт блока ГВС после выбора конкретного БКН (объём и мощность для котла).
 *
 * @param {import('../types/shared-types').HotWaterReport | undefined} hotWater
 * @param {import('../catalog/types').IndirectWaterHeaterCatalogItemNormalized | null} indirectItem
 * @returns {import('../types/shared-types').HotWaterReport | undefined}
 */
export function applyIndirectTankToHotWaterReport(hotWater, indirectItem) {
  if (!hotWater || hotWater.dhwSupplyScenario !== 'storage') return hotWater;
  if (!indirectItem) return hotWater;
  const vol = indirectTankVolumeLiters(indirectItem);
  if (vol <= 0) return hotWater;

  const norms = getWaterNorms();
  const deltaTK = Number(hotWater.deltaTK) || 0;
  const minutes = hotWater.storageHeatTimeMinutes ?? norms.storage.indirectHeatTimeMinutes;
  const storageIndirectHeatPowerKw = Number(
    tankVolumeHeatPowerKw(norms, vol, deltaTK, minutes).toFixed(2),
  );
  const hotWaterPowerKw = Number(
    Math.max(norms.storage.boilerDhwPowerMinKw, storageIndirectHeatPowerKw).toFixed(2),
  );

  return {
    ...hotWater,
    recommendedTankLiters: Math.round(vol),
    storageIndirectHeatPowerKw,
    hotWaterPowerKw,
  };
}

/**
 * Список БКН с учётом типа объекта: в квартире — только настенные (indirect_wall).
 *
 * @param {import('../catalog/types').IndirectWaterHeaterCatalogItemNormalized[]} list
 * @param {'apartment' | 'house'} objectType
 * @returns {{ pool: import('../catalog/types').IndirectWaterHeaterCatalogItemNormalized[]; wallFallbackWarning: string | null }}
 */
function indirectPoolForObjectType(list, objectType) {
  if (objectType !== 'apartment') {
    return { pool: list, wallFallbackWarning: null };
  }
  const wallOnly = list.filter((h) => h.type === 'indirect_wall');
  if (wallOnly.length > 0) {
    return { pool: wallOnly, wallFallbackWarning: null };
  }
  if (list.length > 0) {
    return {
      pool: list,
      wallFallbackWarning:
        'Для квартиры предпочтителен настенный БКН (indirect_wall); в каталоге не найден — подобран другой тип, проверьте габариты.',
    };
  }
  return { pool: [], wallFallbackWarning: null };
}

/**
 * @param {object} args
 * @param {import('../types/shared-types').HotWaterReport | undefined} args.hotWater
 * @param {import('../catalog/types').NormalizedCatalog} args.catalog
 * @param {boolean} args.useIndirectDhw — дом + накопитель + схема двухконтурного котла
 * @param {'apartment' | 'house'} [args.objectType]
 * @returns {import('../types/shared-types').IndirectWaterHeaterMatchingReport}
 */
export function pickIndirectWaterHeater({
  hotWater,
  catalog,
  useIndirectDhw,
  objectType = 'house',
} = {}) {
  /** @type {import('../types/shared-types').IndirectWaterHeaterMatchingReport} */
  const empty = {
    selected: null,
    requiredTankLiters: Number(hotWater?.recommendedTankLiters) || 0,
    coilPowerKw: null,
    heatTimeMinutesFullTank: null,
    effectiveHeatPowerKw: null,
    warnings: [],
    resolvedRecommendations: [],
    skippedReason: null,
  };

  if (!useIndirectDhw) {
    empty.skippedReason =
      'БКН не подбирается: квартира/проточка, отдельный электробойлер или схема без котлового контура ГВС.';
    return empty;
  }

  const list = catalog?.indirectWaterHeaters ?? [];
  if (!Array.isArray(list) || list.length === 0) {
    empty.warnings.push('В каталоге нет бойлеров косвенного нагрева (БКН).');
    empty.skippedReason = 'Пустой каталог БКН.';
    return empty;
  }

  const need = Number(hotWater?.recommendedTankLiters) || 0;
  logger.info('matching.indirectWaterHeater.start', null, {
    requiredTankLiters: need,
    objectType,
  });

  const resolvedType =
    objectType === 'apartment' || objectType === 'house' ? objectType : 'house';
  const { pool, wallFallbackWarning } = indirectPoolForObjectType(
    list,
    resolvedType,
  );

  const sorted = [...pool].sort(
    (a, b) => indirectTankVolumeLiters(a) - indirectTankVolumeLiters(b),
  );

  /** @type {import('../catalog/types').IndirectWaterHeaterCatalogItemNormalized | null} */
  let selected =
    need > 0
      ? sorted.find((h) => indirectTankVolumeLiters(h) >= need) ?? null
      : sorted[0] ?? null;

  if (!selected && sorted.length) {
    selected = sorted[sorted.length - 1];
  }

  const warnings = [];
  if (wallFallbackWarning) {
    warnings.push(wallFallbackWarning);
  }
  /** @type {import('../recommendations/types').ResolvedRecommendation[]} */
  const resolvedRecommendations = [];
  if (selected && need > 0 && indirectTankVolumeLiters(selected) < need) {
    warnings.push(
      `Подобранный БКН меньше расчётного минимума по объёму (${indirectTankVolumeLiters(selected)} л при потребности ≥ ${need} л) — ограничение каталога.`,
    );
  }

  const coilKw = selected ? indirectCoilPowerKw(selected) : null;

  logger.info('matching.indirectWaterHeater.done', null, {
    model: selected?.model ?? null,
    volumeLiters: selected ? indirectTankVolumeLiters(selected) : null,
    coilPowerKw: coilKw,
  });

  return {
    selected,
    requiredTankLiters: need,
    coilPowerKw: coilKw,
    heatTimeMinutesFullTank: null,
    effectiveHeatPowerKw: null,
    warnings,
    resolvedRecommendations,
    skippedReason: null,
  };
}

/**
 * Дополняет отчёт по БКН: время нагрева, согласование с котлом, подсказки по приоритету ГВС.
 *
 * @param {import('../types/shared-types').IndirectWaterHeaterMatchingReport | undefined} indirectReport
 * @param {import('../types/boiler-types').BoilerMatchingReport | undefined} boilerReport
 * @param {import('../types/shared-types').HotWaterReport | undefined} hotWater
 */
export function attachIndirectBoilerCoupling(indirectReport, boilerReport, hotWater) {
  if (!indirectReport?.selected || !hotWater || hotWater.dhwSupplyScenario !== 'storage') {
    return;
  }

  const norms = getWaterNorms();
  const rules = getAppliances().byKind.indirect_water_heater.coupling;

  const vol = indirectTankVolumeLiters(
    /** @type {import('../catalog/types').IndirectWaterHeaterCatalogItemNormalized} */ (
      indirectReport.selected
    ),
  );
  const deltaTK = Number(hotWater.deltaTK) || 0;
  const coilKw = indirectCoilPowerKw(
    /** @type {import('../catalog/types').IndirectWaterHeaterCatalogItemNormalized} */ (
      indirectReport.selected
    ),
  );

  const boilerNominalKw =
    boilerReport?.selected?.powerKw?.max != null
      ? Number(boilerReport.selected.powerKw.max)
      : null;

  const minSourceKw = indirectMinSourcePowerKw(
    /** @type {import('../catalog/types').IndirectWaterHeaterCatalogItemNormalized} */ (
      indirectReport.selected
    ),
  );
  if (
    minSourceKw != null &&
    boilerNominalKw != null &&
    boilerNominalKw + rules.boilerBelowMinSourceToleranceKw < minSourceKw
  ) {
    indirectReport.warnings.push(
      `По каталогу для выбранного БКН рекомендуется источник не ниже ~${minSourceKw.toFixed(1)} кВт; номинал котла (${boilerNominalKw.toFixed(1)} кВт) может быть недостаточен для штатного режима.`,
    );
  }

  if (
    coilKw != null &&
    boilerNominalKw != null &&
    coilKw < boilerNominalKw - rules.coilWeakerThanBoilerToleranceKw
  ) {
    indirectReport.warnings.push(
      `Мощность змеевика БКН (${coilKw.toFixed(1)} кВт) ниже номинала котла (${boilerNominalKw.toFixed(1)} кВт): возможны тактование горелки и увеличенное время нагрева.`,
    );
  }

  let effectiveP =
    coilKw != null && boilerNominalKw != null
      ? Math.min(coilKw, boilerNominalKw)
      : coilKw ?? boilerNominalKw ?? null;

  if (effectiveP == null || effectiveP <= 0) return;

  indirectReport.effectiveHeatPowerKw = Number(effectiveP.toFixed(2));
  const tMin = tankFullHeatTimeMinutes(norms, vol, deltaTK, effectiveP);
  indirectReport.heatTimeMinutesFullTank = tMin;

  if (tMin != null) {
    if (tMin >= rules.heatTimeParasiticHintMinutes) {
      if (!indirectReport.resolvedRecommendations) {
        indirectReport.resolvedRecommendations = [];
      }
      pushRecommendation(
        indirectReport.warnings,
        indirectReport.resolvedRecommendations,
        'WARN_DHW_TIME_LONG',
        {
          heatTimeMinutes: Math.round(tMin),
          thresholdMinutes: rules.heatTimeParasiticHintMinutes,
        },
      );
    } else if (tMin >= rules.heatTimeSoftHintMinutes) {
      indirectReport.warnings.push(
        `Оценочное время полного нагрева бака ~${tMin} мин — ориентир для комфорта при приоритете ГВС (не норматив).`,
      );
    }
  }
}
