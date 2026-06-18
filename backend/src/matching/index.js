/**
 * Назначение: оркестрация подбора оборудования.
 * Описание: единая точка входа matchEquipment — последовательный подбор БКН, котла, радиаторов
 * и водонагревателя с учётом схемы ГВС и обогащением proposal-линий.
 */
import { pickBoiler } from './boiler.js';
import { pickRadiatorsWithProposalLines } from './radiators.js';
import { pickWaterHeater } from './waterHeater.js';
import {
  applyIndirectTankToHotWaterReport,
  attachIndirectBoilerCoupling,
  pickIndirectWaterHeater,
} from './indirectWaterHeater.js';
import { appendIndirectPriorityRoomWarnings } from './indirectPriorityRoomHint.js';
import {
  SCHEME_BOILER_COMBI_BUFFER_ELECTRIC,
  SCHEME_BOILER_ELECTRIC_SEPARATE,
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
} from '../../../shared/heatingMatchingSchemes.js';
import { resolveBoilerCircuitFilterMode } from '../utils/boilerMatchingByType.js';
import { enrichBoilerMatchingProposals } from './enrichProposalBundlePrice.js';
import { alignHeatingGraphForCondensingBoiler } from '../logic/heatingThermalRegimes.js';
import { assertCalcRuntimeContext } from '../reference/assertCalcRuntimeContext.js';
import { logger } from '../utils/logger.js';

/**
 * Єдина точка входу для підбору обладнання.
 * Приймає результати розрахунків та каталог і повертає підібрані позиції.
 *
 * Для дома с БКН: спочатку підбір БКН з каталогу,
 * потім уточнення потужності ГВС по фактичному об'єму бака і підбір котла
 * (схема max або сумма мощностей для «1К + БКН»).
 *
 * @param {object} args
 * @param {import('../types/shared-types').HeatLossReport} args.heatLoss
 * @param {import('../types/shared-types').HotWaterReport} args.hotWater
 * @param {import('../types/shared-types').HeatingSystemInput} args.heatingSystem
 * @param {import('../types/shared-types').BuildingInput | undefined} args.building
 * @param {import('../types/shared-types').UnderfloorHeatingReport | null} [args.underfloorHeating]
 * @param {import('../types/shared-types').CalcRuntimeContext} args.ctx
 * @returns {{
 *   matching: import('../types/shared-types').MatchingReport,
 *   hotWaterForCalculations: import('../types/shared-types').HotWaterReport,
 * }}
 */
/**
 * База отопления для pickBoiler: при ufh_only — отдача ТП вверх, иначе теплопотери ограждения.
 *
 * @param {import('../types/shared-types').HeatingSystemInput | undefined} heatingSystem
 * @param {import('../types/shared-types').HeatLossReport | undefined} heatLoss
 * @param {import('../types/shared-types').UnderfloorHeatingReport | null | undefined} underfloorHeating
 * @returns {{ boilerHeatingLoadWatts: number, envelopeHeatLossWatts: number, usedUfhHeatFlux: boolean }}
 */
function resolveBoilerHeatingLoadWatts(heatingSystem, heatLoss, underfloorHeating) {
  const envelopeHeatLossWatts = heatLoss?.totalWatts ?? 0;
  const emittersMode = heatingSystem?.heatingEmittersMode;

  if (emittersMode !== 'ufh_only') {
    return {
      boilerHeatingLoadWatts: envelopeHeatLossWatts,
      envelopeHeatLossWatts,
      usedUfhHeatFlux: false,
    };
  }

  const ufhWatts = underfloorHeating?.totalHeatFluxUpWatts ?? 0;
  if (ufhWatts > 0) {
    return {
      boilerHeatingLoadWatts: ufhWatts,
      envelopeHeatLossWatts,
      usedUfhHeatFlux: true,
    };
  }

  return {
    boilerHeatingLoadWatts: envelopeHeatLossWatts,
    envelopeHeatLossWatts,
    usedUfhHeatFlux: false,
  };
}

export function matchEquipment({
  heatLoss,
  hotWater,
  heatingSystem,
  building,
  underfloorHeating = null,
  ctx,
} = {}) {
  assertCalcRuntimeContext(ctx);
  const { catalog, waterNorms } = ctx;
  const heatingLoad = resolveBoilerHeatingLoadWatts(
    heatingSystem,
    heatLoss,
    underfloorHeating,
  );

  logger.debug('matching.start', null, {
    heatLossWatts: heatLoss?.totalWatts ?? null,
    boilerHeatingLoadWatts: heatingLoad.boilerHeatingLoadWatts,
    usedUfhHeatFlux: heatingLoad.usedUfhHeatFlux,
  });

  const scheme =
    heatingSystem?.hotWaterBoilerPowerMatchingScheme ?? SCHEME_BOILER_MAX_COMBI;

  const objectMetaType = building?.objectMeta?.objectType;
  const objectType =
    objectMetaType === 'apartment' || objectMetaType === 'house'
      ? objectMetaType
      : 'house';

  const useIndirectDhw =
    scheme !== SCHEME_BOILER_COMBI_BUFFER_ELECTRIC &&
    hotWater?.dhwSupplyScenario === 'storage' &&
    (objectType === 'house' ||
      (objectType === 'apartment' &&
        scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM &&
        building?.objectMeta?.indirectDhwSpaceAvailable === true)) &&
    (scheme === SCHEME_BOILER_MAX_COMBI ||
      scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM);

  /** @type {import('../types/shared-types').IndirectWaterHeaterMatchingReport} */
  let indirectWaterHeater = pickIndirectWaterHeater({
    hotWater,
    catalog,
    useIndirectDhw,
    objectType,
  });

  /** @type {import('../types/shared-types').HotWaterReport | undefined} */
  let hotWaterResolved = hotWater;
  if (hotWaterResolved && indirectWaterHeater.selected) {
    hotWaterResolved = applyIndirectTankToHotWaterReport(
      hotWaterResolved,
      indirectWaterHeater.selected,
      waterNorms,
    );
  }

  const hwForBoiler = hotWaterResolved ?? hotWater;

  const boilerCircuitFilterMode = resolveBoilerCircuitFilterMode({
    scheme,
    dhwSupplyScenario: hwForBoiler?.dhwSupplyScenario,
  });

  const boiler = pickBoiler({
    heatLossWatts: heatingLoad.boilerHeatingLoadWatts,
    hotWaterPowerKw: hwForBoiler?.hotWaterPowerKw ?? 0,
    peakThermalPowerKw: hwForBoiler?.peakThermalPowerKw ?? 0,
    boilerCombustionType: heatingSystem?.boilerCombustionType,
    hotWaterFixtures: hwForBoiler?.fixtures,
    hotWaterBoilerPowerMatchingScheme: scheme,
    dhwSupplyScenario: hwForBoiler?.dhwSupplyScenario,
    boilerCircuitFilterMode,
    selectedWaterHeater: indirectWaterHeater?.selected ?? null,
    objectType,
    building,
    heatingSystem,
    ctx,
  });

  const normWarn =
    heatingSystem && typeof heatingSystem === 'object'
      ? /** @type {Record<string, unknown>} */ (heatingSystem)
          ._normalizationWarnings
      : undefined;
  if (Array.isArray(normWarn) && normWarn.length) {
    boiler.warnings.push(.../** @type {string[]} */ (normWarn));
    const hsForNorm = /** @type {Record<string, unknown>} */ (heatingSystem);
    delete hsForNorm._normalizationWarnings;
  }

  if (heatingSystem?.heatingEmittersMode === 'ufh_only') {
    if (heatingLoad.usedUfhHeatFlux) {
      const ufhRounded = Math.round(heatingLoad.boilerHeatingLoadWatts);
      const envelopeRounded = Math.round(heatingLoad.envelopeHeatLossWatts);
      if (heatingLoad.boilerHeatingLoadWatts < heatingLoad.envelopeHeatLossWatts) {
        boiler.warnings.push(
          `Режим «только тёплый пол»: для подбора котла использована отдача ТП ${ufhRounded} Вт при теплопотерях ограждения ${envelopeRounded} Вт — возможен дефицит покрытия.`,
        );
      } else if (heatingLoad.boilerHeatingLoadWatts !== heatingLoad.envelopeHeatLossWatts) {
        boiler.warnings.push(
          `Режим «только тёплый пол»: мощность котла по отдаче ТП (${ufhRounded} Вт), не по теплопотерям ограждения (${envelopeRounded} Вт).`,
        );
      }
    } else {
      boiler.warnings.push(
        'Режим «только тёплый пол»: отдача ТП не рассчитана — подбор котла выполнен по теплопотерям ограждения.',
      );
    }
  }

  attachIndirectBoilerCoupling(
    indirectWaterHeater,
    boiler,
    hwForBoiler,
    ctx,
  );
  appendIndirectPriorityRoomWarnings(indirectWaterHeater, heatLoss);

  if (
    useIndirectDhw &&
    indirectWaterHeater.selected &&
    scheme === SCHEME_BOILER_MAX_COMBI &&
    boiler.selected?.isDoubleCircuit === true
  ) {
    boiler.warnings.unshift(
      'Двухконтурный котёл с бойлером косвенного нагрева допускается, но гидравлически часто сложнее (приоритет ГВС, согласование контуров). Для типовой связки «1К + БКН» выберите отдельную схему суммирования мощностей.',
    );
  }

  const graphAlignWarning = alignHeatingGraphForCondensingBoiler(
    heatingSystem,
    boiler.selected ?? null,
  );
  if (graphAlignWarning) {
    boiler.warnings.unshift(graphAlignWarning);
    logger.info('matching.boiler.graphAligned', null, {
      thermalRegimePreset: heatingSystem?.thermalRegimePreset ?? null,
      supplyC: heatingSystem?.supplyC ?? null,
      returnC: heatingSystem?.returnC ?? null,
    });
  }

  const radiators = pickRadiatorsWithProposalLines({
    roomsHeatLoss: heatLoss,
    heatingSystem,
    catalog,
    building,
    boiler,
    underfloorHeating,
  });

  /** @type {import('../types/shared-types').WaterHeaterMatchingReport} */
  let waterHeater = {
    selected: null,
    chosenVariant: null,
    warnings: [],
    requiredTankLiters: 0,
  };

  const boilerCircuitFallback = boiler.circuitFallback ?? null;

  if (scheme === SCHEME_BOILER_COMBI_BUFFER_ELECTRIC) {
    waterHeater = pickWaterHeater({ hotWater: hwForBoiler, catalog });
    if (waterHeater.requiredTankLiters > 0) {
      waterHeater.warnings.unshift(
        `Электробойлер подобран как температурный буфер объёмом ${waterHeater.requiredTankLiters} л для сглаживания температурных скачков ГВС двухконтурного котла.`,
      );
    }
  } else if (scheme === SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC) {
    waterHeater = pickWaterHeater({ hotWater: hwForBoiler, catalog });
    if (waterHeater.requiredTankLiters > 0) {
      waterHeater.warnings.unshift(
        `Электробойлер подобран как буфер/накопитель объёмом ${waterHeater.requiredTankLiters} л (схема 1К + буферный ЭВН).`,
      );
    }
  } else if (
    scheme === SCHEME_BOILER_ELECTRIC_SEPARATE &&
    boilerCircuitFallback?.reason === 'no_single_in_catalog'
  ) {
    waterHeater = {
      selected: null,
      chosenVariant: null,
      warnings: [],
      requiredTankLiters: 0,
    };
  } else if (scheme === SCHEME_BOILER_ELECTRIC_SEPARATE) {
    waterHeater = pickWaterHeater({ hotWater: hwForBoiler, catalog });
  } else if (useIndirectDhw) {
    if (indirectWaterHeater.selected) {
      waterHeater = {
        selected: null,
        chosenVariant: null,
        warnings: [],
        requiredTankLiters: Number(hwForBoiler?.recommendedTankLiters) || 0,
      };
    } else {
      waterHeater = pickWaterHeater({ hotWater: hwForBoiler, catalog });
      const noIndirectInCatalog = !catalog?.indirectWaterHeaters?.length;
      const prefix = noIndirectInCatalog
        ? 'В каталоге нет БКН — показан запасной подбор электронакопителя.'
        : 'БКН по расчётному объёму не найден — показан запасной подбор электронакопителя.';
      waterHeater.warnings.unshift(prefix);
    }
  }

  enrichBoilerMatchingProposals(boiler, waterHeater, indirectWaterHeater, {
    scheme,
    objectType,
  });

  logger.debug('matching.done', null, {
    boilerModel: boiler?.selected?.model ?? null,
    radiatorModel: radiators?.chosen?.model ?? null,
    indirectModel: indirectWaterHeater?.selected?.model ?? null,
    waterHeaterModel: waterHeater?.selected?.model ?? null,
  });

  return {
    matching: {
      boiler,
      radiators,
      waterHeater,
      indirectWaterHeater,
    },
    hotWaterForCalculations: hotWaterResolved ?? hotWater,
  };
}
