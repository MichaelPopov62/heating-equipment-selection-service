/**
 * Назначение: подбор котлов из каталога.
 * Описание: фильтрация по контуру, монтажу и типу горения; формирование основной линии и альтернатив
 * proposalEconomy/proposalEfficient; каскад, запас мощности и структурированные рекомендации.
 */
import { buildMatchingSortPools } from '../catalog/matchingSortPools.js';
import { logger } from '../utils/logger.js';
import {
  buildCondensingBoilerMatchingRecommendations,
  buildCondensingCascadeHint,
  buildTraditionalCascadeHint,
  chimneyNotesForBoilerCombustionType,
  condensingDrainNoteText,
  filterBoilersByCircuitMode,
  filterBoilersForEconomyLine,
  filterBoilersForEfficientLine,
  heatingLoadKwForCondensingLine,
  isCondensingBoiler,
  matchesCombustionTypePreference,
  requiredKwFromHeatingAndDhw,
} from '../utils/boilerMatchingByType.js';
import { pushRecommendation } from '../recommendations/recommendationResolver.js';
import { assertCalcRuntimeContext } from '../reference/assertCalcRuntimeContext.js';
import {
  SCHEME_BOILER_ELECTRIC_SEPARATE,
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_COMBI_BUFFER_ELECTRIC,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
  SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC,
} from '../../../shared/heatingMatchingSchemes.js';
import {
  filterBoilersByMountingConstraints,
  resolveObjectType,
} from '../utils/boilerMountingConstraints.js';
import { smallestSingleCircuitMaxKw } from '../utils/apartmentMatching.js';
import {
  apartmentCombiSerialBufferTemplateVars,
  buildApartmentCombiSerialBufferRecommendation,
  isApartmentCombiSerialBufferEligible,
} from '../utils/apartmentCombiSerialBufferHint.js';
import { indirectMinSourcePowerKw } from './internal/indirectCatalogHelpers.js';
import { isHighTemperatureHeatingGraph } from '../logic/heatingThermalRegimes.js';

/**
 * Значение по умолчанию: двухконтурный котёл, при открытии крана — полная отдача на горячую воду (max по мощностям).
 * @type {import('../types/boiler-types.js').HotWaterBoilerPowerMatchingScheme}
 */
const DEFAULT_HOT_WATER_BOILER_POWER_MATCHING_SCHEME = SCHEME_BOILER_MAX_COMBI;

/**
 * @param {import('../catalog/types.js').BoilerCatalogItemNormalized} boiler
 * @param {number} requiredKw
 * @returns {{ count: number, totalNominalKw: number }}
 */
function cascadeForBoiler(boiler, requiredKw) {
  const maxPw = boiler?.powerKw?.max ?? 0;
  if (maxPw <= 0) return { count: 0, totalNominalKw: 0 };
  const count = Math.max(1, Math.ceil(requiredKw / maxPw));
  return { count, totalNominalKw: Number((count * maxPw).toFixed(2)) };
}

/**
 * @param {import('../catalog/types.js').BoilerCatalogItemNormalized[]} boilers
 * @param {number} requiredKw
 * @returns {{ boiler: import('../catalog/types.js').BoilerCatalogItemNormalized, count: number, totalNominalKw: number } | null}
 */
function pickBestCascade(boilers, requiredKw) {
  /** @type {{ boiler: import('../catalog/types.js').BoilerCatalogItemNormalized, count: number, totalNominalKw: number } | null} */
  let best = null;
  for (const b of boilers) {
    const { count, totalNominalKw } = cascadeForBoiler(b, requiredKw);
    if (count < 1) continue;
    if (
      !best ||
      count < best.count ||
      (count === best.count && totalNominalKw < best.totalNominalKw)
    ) {
      best = { boiler: b, count, totalNominalKw };
    }
  }
  return best;
}

/**
 * Самый мощный котёл в пуле по powerKw.max (один аппарат без каскада).
 * @param {import('../catalog/types.js').BoilerCatalogItemNormalized[]} boilers
 * @returns {import('../catalog/types.js').BoilerCatalogItemNormalized | null}
 */
function pickStrongestBoilerFromPool(boilers) {
  if (!boilers?.length) return null;
  /** @type {import('../catalog/types.js').BoilerCatalogItemNormalized | null} */
  let best = null;
  let bestMax = -Infinity;
  for (const b of boilers) {
    const m = Number(b?.powerKw?.max ?? 0);
    if (m > bestMax) {
      bestMax = m;
      best = b;
    }
  }
  return best;
}

/**
 * Разбивка для карточки proposal (поле powerRequirementBreakdown).
 * @param {number} heatingKw отопление×запас для линии карточки
 * @param {number} hwKw расчётная мощность ГВС из отчёта
 * @returns {import('../types/boiler-types.js').BoilerEquipmentProposalPowerBreakdown}
 */
function buildPowerRequirementBreakdown(heatingKw, hwKw) {
  return {
    heatingLoadKw: Number(Math.max(0, Number(heatingKw) || 0).toFixed(2)),
    hotWaterPowerKw: Number(Math.max(0, Number(hwKw) || 0).toFixed(2)),
  };
}

/**
 * Подпись линии «Эффективный» в headline proposal (квартира vs дом, схема ГВС).
 *
 * @param {boolean} electricSeparate
 * @param {'apartment' | 'house'} resolvedObjectType
 * @param {import('../types/boiler-types.js').HotWaterBoilerPowerMatchingScheme} scheme
 * @returns {string}
 */
function efficientProposalHeadlineSuffix(
  electricSeparate,
  resolvedObjectType,
  scheme,
) {
  if (electricSeparate) {
    return 'конденсационный одноконтурный (отопление; ГВС отдельно)';
  }
  if (scheme === SCHEME_BOILER_COMBI_BUFFER_ELECTRIC) {
    return 'конденсационный двухконтурный (max) + буферный ЭВН';
  }
  if (scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM) {
    return 'конденсационный одноконтурный + БКН';
  }
  if (resolvedObjectType === 'apartment') {
    return 'конденсационный одноконтурный (отопление; ГВС — по выбранной схеме)';
  }
  return 'конденсационный одноконтурный + БКН';
}

/**
 * @param {import('../catalog/types.js').BoilerCatalogItemNormalized[]} boilers
 * @param {number} requiredKw
 * @param {'economy' | 'efficient'} tier
 * @param {string} tierHeadlineSuffix
 * @param {object} extra
 * @param {boolean} [extra.forceSingleUnit] без каскада
 * @param {number} [extra.heatingLoadKwForReserve] база для nominalReservePercent по отоплению
 * @param {import('../types/boiler-types.js').BoilerEquipmentProposalPowerBreakdown} extra.powerRequirementBreakdown
 * @param {import('../dhw/types.js').BoilerApplianceRules} extra.boilerRules
 * @returns {import('../types/boiler-types.js').BoilerEquipmentProposal | null}
 */
function pickSingleOrCascadeProposal(
  boilers,
  requiredKw,
  tier,
  tierHeadlineSuffix,
  extra,
) {
  const forceSingleUnit = extra.forceSingleUnit === true;
  const heatingLoadKwForReserve = extra.heatingLoadKwForReserve;
  const powerRequirementBreakdown = extra.powerRequirementBreakdown;
  const boilerRules = extra.boilerRules;
  const req = Math.max(0, Number(requiredKw) || 0);
  if (!boilers.length || req <= 0) return null;
  const selectedSingle =
    boilers.find((b) => (b?.powerKw?.max ?? 0) >= req) ?? null;
  if (selectedSingle) {
    return buildProposalObject(
      selectedSingle,
      'single',
      1,
      selectedSingle.powerKw.max,
      req,
      {
        tier,
        condensingDrainNote: isCondensingBoiler(selectedSingle),
        tierHeadlineSuffix,
        heatingLoadKwForReserve,
        powerRequirementBreakdown,
        boilerRules,
      },
    );
  }
  if (forceSingleUnit) {
    const strongest = pickStrongestBoilerFromPool(boilers);
    if (!strongest) return null;
    const maxPw = Number(strongest.powerKw?.max ?? 0);
    return buildProposalObject(strongest, 'single', 1, maxPw, req, {
      tier,
      condensingDrainNote: isCondensingBoiler(strongest),
      tierHeadlineSuffix,
      heatingLoadKwForReserve,
      powerRequirementBreakdown,
      boilerRules,
    });
  }
  const cascade = pickBestCascade(boilers, req);
  if (!cascade) return null;
  return buildProposalObject(
    cascade.boiler,
    'cascade',
    cascade.count,
    cascade.totalNominalKw,
    req,
    {
      tier,
      condensingDrainNote: isCondensingBoiler(cascade.boiler),
      tierHeadlineSuffix,
      powerRequirementBreakdown,
      boilerRules,
    },
  );
}

/**
 * Пояснения по сценариям горячей воды (дополнение к расчёту по расходам с точек разбора).
 * @param {import('../types/shared-types.js').HotWaterFixturesInput | undefined} fixtures
 * @param {number} hotWaterPowerKw
 * @param {number} heatLossKw потери отопления, кВт
 * @param {number} reserveFactor
 * @param {import('../types/boiler-types.js').HotWaterBoilerPowerMatchingScheme} hotWaterBoilerPowerMatchingScheme
 * @param {'flowThrough' | 'storage' | undefined} dhwSupplyScenario
 * @param {import('../dhw/types.js').BoilerApplianceRules} boilerRules
 * @returns {import('../types/boiler-types.js').BoilerMatchingRecommendation[]}
 */
function buildHotWaterScenarioRecommendations(
  fixtures,
  hotWaterPowerKw,
  heatLossKw,
  reserveFactor,
  hotWaterBoilerPowerMatchingScheme,
  dhwSupplyScenario,
  boilerRules,
) {
  /** @type {import('../types/boiler-types.js').BoilerMatchingRecommendation[]} */
  const out = [];
  const sh = fixtures?.shower ?? 0;
  const bath = fixtures?.bath ?? 0;
  const toilet = fixtures?.toilet ?? 0;
  const sink = fixtures?.sink ?? 0;

  const heatPartKw = Number(heatLossKw) * Number(reserveFactor);
  const electricWaterHeaterScheme =
    hotWaterBoilerPowerMatchingScheme === SCHEME_BOILER_ELECTRIC_SEPARATE;
  const combiBufferElectricScheme =
    hotWaterBoilerPowerMatchingScheme === SCHEME_BOILER_COMBI_BUFFER_ELECTRIC;
  const singleIndirectSumScheme =
    hotWaterBoilerPowerMatchingScheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM;
  const storageScenario = dhwSupplyScenario === 'storage';

  if (sh >= 2) {
    if (electricWaterHeaterScheme) {
      out.push({
        type: 'parallel_hot_water_high_flow_two_showers_electric_storage_water_heater',
        message:
          'Учитывайте одновременный расход двух душей: мощность котла по расчёту только для отопления с запасом; проверьте допустимую скорость нагрева и запас по электросети для накопительного водонагревателя.',
      });
    } else if (storageScenario && singleIndirectSumScheme) {
      out.push({
        type: 'parallel_hot_water_two_showers_single_indirect_sum',
        message:
          'Учитывайте одновременный расход двух душей: при схеме «1К + БКН» требуемая мощность котла — сумма отопления с запасом и нагрева бака; проверьте объём БКН и время восстановления запаса горячей воды.',
      });
    } else if (combiBufferElectricScheme) {
      out.push({
        type: 'parallel_hot_water_two_showers_combi_buffer_electric',
        message:
          'Учитывайте одновременный расход двух душей: котёл подбирается по max(отопление с запасом, пик ГВС); буферный электробойлер сглаживает температурные скачки — проверьте объём буфера и мощность ТЭНа при длительном пике.',
      });
    } else if (storageScenario) {
      out.push({
        type: 'parallel_hot_water_two_showers_storage_boiler_not_from_peak_flow',
        message:
          'Учитывайте одновременный расход двух душей: для дома с накопителем (БКН) расчётная мощность на горячую воду для котла берётся от нагрева бака за заданное время, а не от пика «пролива»; при необходимости увеличьте объём бака или согласуйте время восстановления запаса горячей воды.',
      });
    } else {
      out.push({
        type: 'parallel_hot_water_high_flow_two_showers_combination_boiler_maximum_power_rule',
        message:
          'Учитывайте одновременный расход двух душей: для двухконтурного котла с приоритетом горячей воды требуемая мощность берётся как максимум из отопления с запасом и расчёта горячей воды (без суммирования). При высоких пиках рассмотрите схему одноконтурного котла с БКН (поле heatingSystem.hotWaterBoilerPowerMatchingScheme).',
      });
    }
  }

  const hintRules = boilerRules.hints;
  if (
    !electricWaterHeaterScheme &&
    !storageScenario &&
    sh <= 1 &&
    bath <= 1 &&
    toilet >= 1 &&
    sink >= 1 &&
    heatPartKw <= hintRules.comfortHotWaterHeatPartKwMax &&
    hotWaterPowerKw <= hintRules.comfortHotWaterDhwKwMax
  ) {
    const typicalKw = hintRules.comfortHotWaterTypicalBoilerKw;
    out.push({
      type: 'comfort_hot_water_typical_twenty_four_kilowatt_hint_combination_boiler',
      message: `При двух санузлах с умеренным водоразбором и небольшой тепловой нагрузке на отопление часто выбирают котлы около ${typicalKw} кВт для комфорта горячей воды — сверьте с расчётной требуемой мощностью котла и паспортом.`,
    });
  }

  return out;
}

/**
 * @param {import('../catalog/types.js').BoilerCatalogItemNormalized} boiler
 * @param {'single' | 'cascade'} kind
 * @param {number} unitsCount
 * @param {number} totalNominalKw
 * @param {number} requiredKw
 * @param {object} opts
 * @param {'economy' | 'efficient'} [opts.tier]
 * @param {boolean} [opts.condensingDrainNote]
 * @param {string} [opts.tierHeadlineSuffix]
 * @param {number} [opts.heatingLoadKwForReserve] база процента запаса для одиночного котла: отопление×запас (или конденсационная база), сравнение с powerKw.min
 * @param {import('../types/boiler-types.js').BoilerEquipmentProposalPowerBreakdown} opts.powerRequirementBreakdown составляющие для UI («из них на отопление / ГВС»)
 * @param {import('../dhw/types.js').BoilerApplianceRules} [opts.boilerRules]
 * @returns {import('../types/boiler-types.js').BoilerEquipmentProposal}
 */
function buildProposalObject(
  boiler,
  kind,
  unitsCount,
  totalNominalKw,
  requiredKw,
  opts,
) {
  const req = Math.max(0, Number(requiredKw) || 0);
  const heatingBasis = opts.heatingLoadKwForReserve;
  /** @type {number} */
  let nominalReservePercent = 0;
  if (kind === 'single' && heatingBasis != null && Number(heatingBasis) > 0) {
    const boilerMin = Number(boiler.powerKw?.min ?? boiler.powerKw?.max ?? 0);
    const hl = Number(heatingBasis);
    const cap = opts.boilerRules?.matching.nominalReservePercentCap ?? 150;
    nominalReservePercent = Math.min(
      Math.round(((boilerMin - hl) / hl) * 100),
      cap,
    );
  } else if (req > 0) {
    nominalReservePercent = Number(
      ((totalNominalKw / req - 1) * 100).toFixed(1),
    );
  }

  const tier = opts.tier;
  const tierHeadlineSuffix = opts.tierHeadlineSuffix ?? '';
  let headline = kind === 'single' ? 'Одиночный котёл' : 'Каскадная котельная';
  if (tier === 'economy') {
    headline =
      kind === 'cascade'
        ? `Эконом: каскад (${tierHeadlineSuffix})`
        : `Эконом: один котёл (${tierHeadlineSuffix})`;
  }
  if (tier === 'efficient') {
    headline =
      kind === 'cascade'
        ? `Эффективный: каскад (${tierHeadlineSuffix})`
        : `Эффективный: один котёл (${tierHeadlineSuffix})`;
  }

  /** @type {string[]} */
  const advantages = [];
  if (kind === 'cascade' && unitsCount > 1) {
    advantages.push(
      `Резервирование: при отказе одного аппарата остальные ${unitsCount - 1} продолжают отопление (с понижением мощности).`,
    );
  }
  const eff = boiler.efficiencyPercent;
  if (eff != null && Number.isFinite(eff)) {
    advantages.push(
      `Заявленный КПД до ${eff}% (по паспортным данным производителя; для конденсационных моделей часто приводят к ВНК).`,
    );
  }

  /** @type {string[]} */
  const notes = [];
  if (req > 50) {
    notes.push(
      'Внимание! При такой расчётной мощности рекомендуется гидравлический разделитель (гидрострелка) и согласование с проектом.',
    );
  }
  if (opts.condensingDrainNote && isCondensingBoiler(boiler)) {
    notes.push(condensingDrainNoteText());
  }
  notes.push(...chimneyNotesForBoilerCombustionType(boiler));

  /** @type {import('../types/boiler-types.js').BoilerEquipmentProposal} */
  const proposal = {
    kind,
    headline,
    model: boiler.model,
    unitsCount,
    unitMaxPowerKw: Number((boiler.powerKw?.max ?? 0).toFixed(2)),
    totalNominalKw: Number(totalNominalKw.toFixed(2)),
    requiredKw: Number(req.toFixed(2)),
    powerRequirementBreakdown: opts.powerRequirementBreakdown,
    nominalReservePercent,
    advantages,
    notes,
  };
  if (tier) proposal.tier = tier;

  if (boiler.price != null && Number.isFinite(boiler.price)) {
    proposal.estimatedTotalPrice = Number(
      (boiler.price * unitsCount).toFixed(2),
    );
  }
  if (boiler.mountingType) proposal.mountingType = boiler.mountingType;
  if (boiler.connectionDiameters?.length) {
    proposal.connectionDiameters = [...boiler.connectionDiameters];
  }

  return proposal;
}

/**
 * Підбір котла з каталогу під розрахункове навантаження.
 *
 * @param {object} args
 * @param {number} args.heatLossWatts
 * @param {number} [args.hotWaterPowerKw]
 * @param {number} [args.peakThermalPowerKw] пик проточной ГВС, кВт — для max-combi при storage-сценарии (1К + электробойлер)
 * @param {number} [args.reserveFactor]
 * @param {import('../types/boiler-types.js').BoilerCombustionType} [args.boilerCombustionType]
 * @param {import('../types/shared-types.js').HotWaterFixturesInput} [args.hotWaterFixtures]
 * @param {import('../types/boiler-types.js').HotWaterBoilerPowerMatchingScheme} [args.hotWaterBoilerPowerMatchingScheme]
 * @param {'flowThrough' | 'storage'} [args.dhwSupplyScenario] из расчёта hotWater (тип объекта)
 * @param {'double' | 'single' | null} [args.boilerCircuitFilterMode] фильтр каталога по контурам; из matchEquipment — всегда resolveBoilerCircuitFilterMode (single | double, без null)
 * @param {import('../catalog/types.js').IndirectWaterHeaterCatalogItemNormalized | null} [args.selectedWaterHeater] выбранный БКН (для схемы «1К + БКН» — учёт specs.minSourcePowerKw при подборе и в альтернативной линии «Эффективный»)
 * @param {'apartment' | 'house'} [args.objectType] квартира или двухконтурная схема — без каскада (один котёл)
 * @param {import('../types/shared-types.js').BuildingInput} [args.building] анкета (objectMeta, rooms) - фильтр монтажа
 * @param {import('../types/shared-types.js').HeatingSystemInput} [args.heatingSystem]
 * @param {import('../types/shared-types.js').CalcRuntimeContext} args.ctx
 * @returns {import('../types/boiler-types.js').BoilerMatchingReport}
 */
export function pickBoiler({
  heatLossWatts,
  hotWaterPowerKw = 0,
  peakThermalPowerKw = 0,
  reserveFactor: reserveFactorArg,
  boilerCombustionType = undefined,
  hotWaterFixtures = undefined,
  hotWaterBoilerPowerMatchingScheme = undefined,
  dhwSupplyScenario = undefined,
  boilerCircuitFilterMode = null,
  selectedWaterHeater = null,
  objectType = 'house',
  building = undefined,
  heatingSystem = undefined,
  ctx,
}) {
  assertCalcRuntimeContext(ctx);
  const { catalog, appliances, recommendations: recommendationsBundle } = ctx;
  const boilerRules = appliances.byKind.boiler;
  const reserveFactor =
    reserveFactorArg ?? boilerRules.matching.heatingReserveFactor;
  const objectMeta = building?.objectMeta;
  const resolvedObjectType = objectMeta
    ? resolveObjectType(objectMeta)
    : objectType === 'apartment'
      ? 'apartment'
      : 'house';
  const heatLossKw = (Number(heatLossWatts) || 0) / 1000;
  const heatingLoadKw = heatLossKw * reserveFactor;
  const heatingLoadKwCondensing = heatingLoadKwForCondensingLine(
    heatLossKw,
    boilerRules,
  );
  const hwKw = Number(hotWaterPowerKw) || 0;
  const peakHwKw = Number(peakThermalPowerKw) || 0;
  /** @type {import('../types/boiler-types.js').HotWaterBoilerPowerMatchingScheme} */
  const scheme =
    hotWaterBoilerPowerMatchingScheme ??
    DEFAULT_HOT_WATER_BOILER_POWER_MATCHING_SCHEME;

  /** @type {import('../types/boiler-types.js').HotWaterBoilerPowerMatchingScheme} */
  let effectiveScheme = scheme;
  /** @type {import('../types/boiler-types.js').BoilerCircuitFallbackReport | null} */
  let circuitFallback = null;

  const forceSingleBoiler =
    resolvedObjectType === 'apartment' ||
    scheme === SCHEME_BOILER_MAX_COMBI ||
    scheme === SCHEME_BOILER_COMBI_BUFFER_ELECTRIC;

  const hwKwForBoilerFormulaEarly =
    scheme === SCHEME_BOILER_MAX_COMBI ||
    scheme === SCHEME_BOILER_COMBI_BUFFER_ELECTRIC
      ? peakHwKw > 0
        ? peakHwKw
        : hwKw
      : hwKw;

  let requiredKw = requiredKwFromHeatingAndDhw(
    scheme,
    heatingLoadKw,
    hwKwForBoilerFormulaEarly,
  );
  let requiredKwCondensing = requiredKwFromHeatingAndDhw(
    scheme,
    heatingLoadKwCondensing,
    hwKwForBoilerFormulaEarly,
  );

  const minSourceKwBkn = indirectMinSourcePowerKw(selectedWaterHeater);
  if (scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM && minSourceKwBkn != null) {
    requiredKw = Math.max(requiredKw, minSourceKwBkn);
    requiredKwCondensing = Math.max(requiredKwCondensing, minSourceKwBkn);
  }

  logger.info('matching.boiler.start', null, {
    heatLossKw,
    reserveFactor,
    heatingLoadKw,
    heatingLoadKwCondensing,
    hotWaterPowerKw: hwKw,
    hotWaterBoilerPowerMatchingScheme: scheme,
    requiredKw,
    requiredKwCondensing,
    minSourcePowerKwIndirect: minSourceKwBkn,
    boilerCombustionType: boilerCombustionType ?? null,
    dhwSupplyScenario: dhwSupplyScenario ?? null,
    boilerCircuitFilterMode: boilerCircuitFilterMode ?? null,
    forceSingleBoiler,
    objectType: resolvedObjectType,
    boilerPlacementZone: objectMeta?.boilerPlacementZone ?? null,
  });

  const sortPools = buildMatchingSortPools(catalog);
  const boilersAll = sortPools.boilersSortedByMaxPower;
  const boilersPositive = boilersAll.filter(
    (b) => (Number(b?.powerKw?.max) || 0) > 0,
  );

  /** @type {import('../catalog/types.js').BoilerCatalogItemNormalized[]} */
  let boilersFiltered = boilersPositive.filter((b) =>
    matchesCombustionTypePreference(
      boilerCombustionType,
      /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (b)),
    ),
  );
  /** @type {import('../types/boiler-types.js').BoilerCombustionType | null} */
  let combustionTypeFilterApplied = boilerCombustionType ?? null;

  const warnings = [];
  /** @type {import('../recommendations/types.js').ResolvedRecommendation[]} */
  const resolvedRecommendations = [];
  let boilerUnderpoweredFromCatalog = false;
  if (
    boilerCombustionType &&
    boilersFiltered.length === 0 &&
    boilersPositive.length > 0
  ) {
    warnings.push(
      `В каталоге нет котлов с combustionType="${boilerCombustionType}" — подбор выполнен по полному списку.`,
    );
    boilersFiltered = boilersPositive;
    combustionTypeFilterApplied = null;
  }

  /** Пул после фильтра камеры — альтернативная линия «Эффективный» без ограничения контура основного режима */
  let boilersAfterCombustion = boilersFiltered;

  const countBeforeMounting = boilersFiltered.length;
  boilersFiltered = filterBoilersByMountingConstraints(
    boilersFiltered,
    objectMeta,
    building,
    boilerRules.mounting,
  );
  boilersAfterCombustion = filterBoilersByMountingConstraints(
    boilersAfterCombustion,
    objectMeta,
    building,
    boilerRules.mounting,
  );
  if (countBeforeMounting > 0 && boilersFiltered.length === 0) {
    warnings.push(
      resolvedObjectType === 'apartment'
        ? `Нет котлов в каталоге, подходящих для квартиры (настенные, номинал до ${boilerRules.mounting.maxApartmentNominalKw} кВт; напольные модели исключены).`
        : 'Нет котлов, подходящих по типу монтажа и зоне установки (напольные — только при boilerPlacementZone=boiler_room и достаточном объёме котельной).',
    );
  }

  const countBeforeCircuit = boilersAfterCombustion.length;

  /** @type {'double' | 'single' | null} */
  let circuitFilterModeEffective = boilerCircuitFilterMode;
  const singlePoolPreview = filterBoilersByCircuitMode(
    boilersAfterCombustion,
    'single',
  );

  if (
    scheme === SCHEME_BOILER_ELECTRIC_SEPARATE &&
    resolvedObjectType === 'apartment'
  ) {
    const aptRules = boilerRules.apartmentClassification;
    const smallestSingleMax = smallestSingleCircuitMaxKw(singlePoolPreview);
    /** @type {'no_single_in_catalog' | null} */
    let fallbackReason = null;

    if (singlePoolPreview.length === 0 && boilersAfterCombustion.length > 0) {
      fallbackReason = 'no_single_in_catalog';
    } else if (
      singlePoolPreview.length > 0 &&
      heatingLoadKw > 0 &&
      smallestSingleMax != null &&
      smallestSingleMax / heatingLoadKw >= aptRules.singleCircuitOversizeRatio
    ) {
      pushRecommendation(
        warnings,
        resolvedRecommendations,
        recommendationsBundle,
        'REC_APT_SINGLE_TO_COMBI_OPTIMIZATION',
        {
          heatingLoadKw: Number(heatingLoadKw.toFixed(1)),
          smallestSingleMaxKw: Number((smallestSingleMax ?? 0).toFixed(1)),
        },
      );
      warnings.push(
        `Минимальный одноконтурный котёл в каталоге (${Number(smallestSingleMax.toFixed(1))} кВт) существенно выше расчётной отопительной нагрузки (${Number(heatingLoadKw.toFixed(1))} кВт). Сохранена схема «1К + электробойлер»: котёл — только отопление, ГВС — накопитель. Для перехода на двухконтурный котёл см. рекомендацию REC_APT_SINGLE_TO_COMBI_OPTIMIZATION.`,
      );
    }

    if (fallbackReason === 'no_single_in_catalog') {
      effectiveScheme = SCHEME_BOILER_MAX_COMBI;
      circuitFilterModeEffective = 'double';
      circuitFallback = {
        from: 'single',
        to: 'double',
        reason: fallbackReason,
        effectiveScheme,
        ...(smallestSingleMax != null
          ? { smallestSingleMaxKw: Number(smallestSingleMax.toFixed(1)) }
          : {}),
      };
      requiredKw = requiredKwFromHeatingAndDhw(
        effectiveScheme,
        heatingLoadKw,
        peakHwKw > 0 ? peakHwKw : hwKw,
      );
      requiredKwCondensing = requiredKwFromHeatingAndDhw(
        effectiveScheme,
        heatingLoadKwCondensing,
        peakHwKw > 0 ? peakHwKw : hwKw,
      );

      pushRecommendation(
        warnings,
        resolvedRecommendations,
        recommendationsBundle,
        'WARN_APT_ELECTRIC_TO_COMBI_NO_SINGLE',
      );
    }
  }

  boilersFiltered = filterBoilersByCircuitMode(
    boilersAfterCombustion,
    circuitFilterModeEffective,
  );
  if (
    circuitFilterModeEffective === 'single' &&
    scheme === SCHEME_BOILER_ELECTRIC_SEPARATE &&
    !circuitFallback &&
    countBeforeCircuit > 0 &&
    boilersFiltered.length === 0
  ) {
    boilersFiltered = boilersAfterCombustion;
    warnings.push(
      'Для схемы с электробойлером рекомендуется одноконтурный котёл, но в каталоге под требуемую мощность (с учётом фильтра камеры) найдены только двухконтурные модели. Подобрана двухконтурная модель в качестве вынужденного технологического резерва.',
    );
  } else if (
    circuitFilterModeEffective &&
    countBeforeCircuit > 0 &&
    boilersFiltered.length === 0
  ) {
    warnings.push(
      circuitFilterModeEffective === 'double'
        ? 'В каталоге нет двухконтурных котлов по фильтру — подбор по выбранной схеме невозможен.'
        : 'В каталоге нет одноконтурных котлов по фильтру — подбор по схеме «1К + БКН» невозможен.',
    );
  }

  /** Для max-combi — пик проточки; для 1К + накопитель — мощность бака (к котлу не суммируется). */
  const hwKwForBoilerFormula =
    effectiveScheme === SCHEME_BOILER_MAX_COMBI ||
    effectiveScheme === SCHEME_BOILER_COMBI_BUFFER_ELECTRIC
      ? peakHwKw > 0
        ? peakHwKw
        : hwKw
      : hwKw;
  /** В карточках proposal — 0 для «1К + электро», иначе значение для формулы котла. */
  const hwKwForBreakdown =
    effectiveScheme === SCHEME_BOILER_ELECTRIC_SEPARATE ||
    effectiveScheme === SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC
      ? 0
      : hwKwForBoilerFormula;

  const selectedSingle =
    boilersFiltered.find((b) => (b?.powerKw?.max ?? 0) >= requiredKw) ?? null;

  /** @type {import('../types/boiler-types.js').BoilerMatchingRecommendation[]} */
  const recommendations = [];

  if (effectiveScheme === SCHEME_BOILER_MAX_COMBI) {
    const storageClause =
      dhwSupplyScenario === 'storage'
        ? ' Для дома с накопителем мощность горячей воды в расчёте берётся от нагрева бака за заданное время (не от пика пролива).'
        : '';
    recommendations.push({
      type: 'combination_boiler_hot_water_priority_maximum_formula',
      message:
        'Двухконтурный котёл с приоритетом горячей воды: расчётная требуемая мощность — максимум из отопительной нагрузки с запасом и расчётной мощности на горячую воду (без суммирования).' +
        storageClause,
    });
  } else if (effectiveScheme === SCHEME_BOILER_COMBI_BUFFER_ELECTRIC) {
    recommendations.push({
      type: 'combination_boiler_buffer_electric_storage_maximum_formula',
      message:
        'Двухконтурный котёл с буферным электробойлером: котёл греет проток ГВС — требуемая мощность max(отопление с запасом, пик ГВС); электробойлер — температурный буфер меньшего объёма для сглаживания «холодного плевка» и пиков.',
    });
  } else if (effectiveScheme === SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC) {
    recommendations.push({
      type: 'single_circuit_boiler_buffer_electric_storage_heating_only',
      message:
        'Одноконтурный котёл с буферным электробойлером: котёл подбирается только по отоплению с запасом; горячая вода — накопительный электробойлер по норме singleCircuitBufferElectricStorage.',
    });
  } else if (effectiveScheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM) {
    recommendations.push({
      type: 'single_circuit_boiler_indirect_tank_sum_formula',
      message:
        'Одноконтурный котёл с бойлером косвенного нагрева: расчётная требуемая мощность котла — сумма отопительной нагрузки с запасом и мощности нагрева бака за целевое время (не максимум и не пик проточки).',
    });
  } else {
    recommendations.push({
      type: 'single_circuit_boiler_electric_storage_water_heater_heating_load_only',
      message:
        'Схема с отдельным накопительным электрическим водонагревателем: котёл подбирается только по отопительной нагрузке с запасом; расчётная мощность на горячую воду к котлу не добавляется.',
    });
  }

  recommendations.push(
    ...buildHotWaterScenarioRecommendations(
      hotWaterFixtures,
      hwKw,
      heatLossKw,
      reserveFactor,
      effectiveScheme,
      dhwSupplyScenario,
      boilerRules,
    ),
  );

  if (
    isApartmentCombiSerialBufferEligible({
      objectType: resolvedObjectType,
      requestedScheme: scheme,
      circuitFallback,
      dhwSupplyScenario,
      fixtures: hotWaterFixtures,
      peakThermalPowerKw: peakHwKw > 0 ? peakHwKw : hwKw,
      serialBufferConfig: boilerRules.hints.apartmentCombiSerialBuffer,
    })
  ) {
    const serialRec = buildApartmentCombiSerialBufferRecommendation(
      boilerRules.hints.apartmentCombiSerialBuffer,
      recommendationsBundle,
    );
    if (serialRec) {
      recommendations.push(serialRec);
      pushRecommendation(
        warnings,
        resolvedRecommendations,
        recommendationsBundle,
        'REC_APT_COMBI_SERIAL_BUFFER',
        apartmentCombiSerialBufferTemplateVars(
          boilerRules.hints.apartmentCombiSerialBuffer,
        ),
      );
    }
  }

  /** @type {import('../catalog/types.js').BoilerCatalogItemNormalized | null} */
  let selected = selectedSingle;

  /** @type {import('../types/boiler-types.js').BoilerEquipmentProposal | null} */
  let proposal = null;

  if (!boilersFiltered.length) {
    warnings.push(
      boilersAll.length
        ? 'В каталоге есть котлы, но ни у одного нет положительной powerKw.max — проверьте данные.'
        : 'Каталог котлов пуст.',
    );
  } else if (requiredKw <= 0) {
    const fallback = boilersFiltered[0];
    if (!fallback) {
      selected = null;
      proposal = null;
    } else {
      selected = fallback;
      proposal = buildProposalObject(
        fallback,
        'single',
        1,
        fallback.powerKw.max,
        0,
        {
          condensingDrainNote: isCondensingBoiler(fallback),
          heatingLoadKwForReserve: heatingLoadKw,
          powerRequirementBreakdown: buildPowerRequirementBreakdown(
            heatingLoadKw,
            hwKwForBreakdown,
          ),
          boilerRules,
        },
      );
    }
  } else if (selectedSingle) {
    proposal = buildProposalObject(
      selectedSingle,
      'single',
      1,
      selectedSingle.powerKw.max,
      requiredKw,
      {
        condensingDrainNote: isCondensingBoiler(selectedSingle),
        heatingLoadKwForReserve: heatingLoadKw,
        powerRequirementBreakdown: buildPowerRequirementBreakdown(
          heatingLoadKw,
          hwKwForBreakdown,
        ),
        boilerRules,
      },
    );
  } else if (forceSingleBoiler) {
    const strongest = pickStrongestBoilerFromPool(boilersFiltered);
    if (strongest) {
      selected = strongest;
      const maxPw = Number(strongest.powerKw?.max ?? 0);
      proposal = buildProposalObject(
        strongest,
        'single',
        1,
        maxPw,
        requiredKw,
        {
          condensingDrainNote: isCondensingBoiler(strongest),
          heatingLoadKwForReserve: heatingLoadKw,
          powerRequirementBreakdown: buildPowerRequirementBreakdown(
            heatingLoadKw,
            hwKwForBreakdown,
          ),
          boilerRules,
        },
      );
      if (maxPw < requiredKw) {
        const pk = Number(maxPw.toFixed(1));
        const rq = Number(requiredKw.toFixed(1));
        if (
          effectiveScheme === SCHEME_BOILER_MAX_COMBI ||
          effectiveScheme === SCHEME_BOILER_COMBI_BUFFER_ELECTRIC
        ) {
          warnings.push(
            `Мощности проточного режима котла (${pk} кВт) может не хватить на одновременный жесткий пик ГВС зимой, рекомендуется ограничить расход.`,
          );
        } else {
          boilerUnderpoweredFromCatalog = true;
          pushRecommendation(
            warnings,
            resolvedRecommendations,
            recommendationsBundle,
            'WARN_BOILER_UNDERPOWERED',
            {
              boilerMaxKw: pk,
              requiredKw: rq,
            },
          );
        }
      }
    }
  } else {
    const cascade = pickBestCascade(boilersFiltered, requiredKw);
    if (cascade) {
      selected = cascade.boiler;
      proposal = buildProposalObject(
        cascade.boiler,
        'cascade',
        cascade.count,
        cascade.totalNominalKw,
        requiredKw,
        {
          condensingDrainNote: isCondensingBoiler(cascade.boiler),
          powerRequirementBreakdown: buildPowerRequirementBreakdown(
            heatingLoadKw,
            hwKwForBreakdown,
          ),
          boilerRules,
        },
      );
    } else {
      logger.warn('matching.boiler.cascade_unexpected', null, {
        requiredKw,
        boilersWithMax: boilersFiltered.length,
      });
      warnings.push(
        'Не удалось сформировать каскад по каталогу — проверьте поля powerKw у котлов.',
      );
    }
  }

  const economyPool = filterBoilersForEconomyLine(boilersFiltered);
  const efficientCandidates = filterBoilersForEfficientLine(
    boilersAfterCombustion,
  );
  const combiBufferScheme =
    scheme === SCHEME_BOILER_COMBI_BUFFER_ELECTRIC ||
    effectiveScheme === SCHEME_BOILER_COMBI_BUFFER_ELECTRIC;
  const maxCombiEffective =
    effectiveScheme === SCHEME_BOILER_MAX_COMBI ||
    circuitFallback?.effectiveScheme === SCHEME_BOILER_MAX_COMBI;
  /** 2К + буфер / вынужденный max-combi после fallback — пул 2К; иначе 1К для «1К + БКН» / «1К + электро». */
  const efficientCircuitMode =
    combiBufferScheme || maxCombiEffective ? 'double' : 'single';
  const efficientPool = filterBoilersByCircuitMode(
    efficientCandidates,
    efficientCircuitMode,
  );

  if (efficientCandidates.length > 0) {
    recommendations.push(
      ...buildCondensingBoilerMatchingRecommendations(
        reserveFactor,
        boilerRules,
      ),
    );
  }

  /** @type {import('../types/boiler-types.js').BoilerEquipmentProposal | null} */
  let proposalEconomy = null;
  /** @type {import('../types/boiler-types.js').BoilerEquipmentProposal | null} */
  let proposalEfficient = null;

  /** Мощность для подсказки каскада по альтернативе «Эффективный» (та же база, что и proposalEfficient.requiredKw при успешном подборе). */
  let reqEfficientLine = 0;

  if (requiredKw > 0) {
    // Та же расчётная потребность, что у основной линии — чтобы totalNominalKw и requiredKw
    // в карточке «Эконом» сравнимы с proposal/proposalEfficient (не только отопление×запас).
    proposalEconomy = pickSingleOrCascadeProposal(
      economyPool,
      requiredKw,
      'economy',
      'традиционный / бюджетный',
      {
        forceSingleUnit: forceSingleBoiler,
        heatingLoadKwForReserve: heatingLoadKw,
        powerRequirementBreakdown: buildPowerRequirementBreakdown(
          heatingLoadKw,
          hwKwForBreakdown,
        ),
        boilerRules,
      },
    );

    // Схема с отдельным электробойлером: котёл только под отопление×запас (как proposal/requiredKw),
    // без суммы с ГВС и без порога minSourcePowerKw БКН — иначе ложно раздувает конденсационную ветку.
    const electricSeparate =
      effectiveScheme === SCHEME_BOILER_ELECTRIC_SEPARATE;
    const efficientHeatingBaseKw = electricSeparate
      ? heatingLoadKw
      : heatingLoadKwCondensing;

    let reqEfficient;
    if (electricSeparate) {
      reqEfficient = requiredKwFromHeatingAndDhw(
        SCHEME_BOILER_ELECTRIC_SEPARATE,
        heatingLoadKw,
        hwKw,
      );
    } else if (
      maxCombiEffective ||
      effectiveScheme === SCHEME_BOILER_COMBI_BUFFER_ELECTRIC
    ) {
      reqEfficient = requiredKwFromHeatingAndDhw(
        SCHEME_BOILER_MAX_COMBI,
        heatingLoadKwCondensing,
        hwKwForBoilerFormula,
      );
    } else {
      reqEfficient = requiredKwFromHeatingAndDhw(
        SCHEME_BOILER_SINGLE_INDIRECT_SUM,
        heatingLoadKwCondensing,
        hwKw,
      );
      if (minSourceKwBkn != null && minSourceKwBkn > reqEfficient) {
        reqEfficient = minSourceKwBkn;
      }
    }
    reqEfficientLine = reqEfficient;

    proposalEfficient = pickSingleOrCascadeProposal(
      efficientPool,
      reqEfficient,
      'efficient',
      efficientProposalHeadlineSuffix(
        electricSeparate,
        resolvedObjectType,
        scheme,
      ),
      {
        forceSingleUnit: forceSingleBoiler,
        heatingLoadKwForReserve: efficientHeatingBaseKw,
        powerRequirementBreakdown: buildPowerRequirementBreakdown(
          efficientHeatingBaseKw,
          hwKwForBreakdown,
        ),
        boilerRules,
      },
    );
  }

  if (!proposalEconomy && economyPool.length === 0 && requiredKw > 0) {
    warnings.push(
      'В каталоге нет традиционных (не конденсационных) котлов для линии «Эконом».',
    );
  }
  if (!proposalEfficient && requiredKw > 0) {
    if (!efficientCandidates.length) {
      warnings.push(
        'В каталоге нет конденсационных котлов для линии «Эффективный».',
      );
    } else if (!efficientPool.length) {
      warnings.push(
        scheme === SCHEME_BOILER_ELECTRIC_SEPARATE
          ? 'Для линии «Эффективный» нужны одноконтурные конденсационные котлы — после фильтра камеры они в каталоге не найдены.'
          : combiBufferScheme
            ? 'Для линии «Эффективный» (2К + буферный ЭВН) нужны двухконтурные конденсационные котлы — после фильтра камеры они в каталоге не найдены.'
            : 'Для альтернативы «1К + БКН» нужны одноконтурные конденсационные котлы — после фильтра камеры они в каталоге не найдены.',
      );
    }
  }

  const tradCascade = buildTraditionalCascadeHint(requiredKw, boilerRules);
  if (
    proposal &&
    proposal.kind === 'single' &&
    tradCascade &&
    !forceSingleBoiler
  ) {
    recommendations.push(tradCascade);
  }

  if (selected && requiredKw > 0 && !boilerUnderpoweredFromCatalog) {
    const selMax = Number(selected.powerKw?.max ?? 0);
    const covers =
      proposal?.kind === 'cascade'
        ? Number(proposal.totalNominalKw ?? 0) >= requiredKw
        : selMax >= requiredKw;
    if (covers) {
      pushRecommendation(
        warnings,
        resolvedRecommendations,
        recommendationsBundle,
        'REC_BOILER_OPTIMAL',
      );
    }
  }

  if (proposalEfficient?.kind === 'single' && !forceSingleBoiler) {
    const condHint =
      reqEfficientLine > 0
        ? buildCondensingCascadeHint(reqEfficientLine, boilerRules)
        : buildCondensingCascadeHint(requiredKwCondensing, boilerRules);
    if (condHint) recommendations.push(condHint);
  }

  if (proposal) {
    logger.info('matching.boiler.proposal', null, {
      kind: proposal.kind,
      model: proposal.model,
      unitsCount: proposal.unitsCount,
      totalNominalKw: proposal.totalNominalKw,
    });
  }
  if (proposalEfficient && selectedWaterHeater?.type === 'indirect_floor') {
    proposalEfficient.notes.push(
      'Для выбранного напольного БКН нужно дополнительное напольное пространство рядом с котлом.',
    );
  }
  if (
    proposalEfficient &&
    resolvedObjectType === 'apartment' &&
    scheme === SCHEME_BOILER_MAX_COMBI
  ) {
    proposalEfficient.notes.push(
      'Линия «Эффективный» — конденсационный котёл по отоплению; для max-combi в квартире БКН в эту связку не входит.',
    );
  }

  if (heatingSystem?.heatingEmittersMode === 'ufh_only') {
    const hs = heatingSystem;
    const boilerModel =
      typeof selected?.model === 'string' ? selected.model : 'котёл';
    const highTempGraph = isHighTemperatureHeatingGraph(hs);
    const nonCondensing = Boolean(selected && !isCondensingBoiler(selected));

    if (highTempGraph || nonCondensing) {
      const thermalRegimeLabel =
        typeof hs.supplyC === 'number' && typeof hs.returnC === 'number'
          ? `${hs.supplyC}/${hs.returnC} °C`
          : hs.thermalRegimePreset === 'traditional_dt50_75_65'
            ? 'традиционный 75/65'
            : hs.thermalRegimePreset === 'condensing_dt30_55_45'
              ? '55/45'
              : 'не задан';
      pushRecommendation(
        warnings,
        resolvedRecommendations,
        recommendationsBundle,
        'WARN_UFH_ONLY_TRADITIONAL_BOILER',
        {
          supplyC: hs.supplyC,
          returnC: hs.returnC,
          thermalRegimeLabel,
          boilerModel,
        },
      );
    }
  }

  return {
    heatLossKw: Number(heatLossKw.toFixed(2)),
    reserveFactor,
    hotWaterPowerKw: Number(hwKw.toFixed(1)),
    heatingLoadKw: Number(heatingLoadKw.toFixed(2)),
    hotWaterBoilerPowerMatchingScheme: scheme,
    ...(effectiveScheme !== scheme
      ? { effectiveHotWaterBoilerPowerMatchingScheme: effectiveScheme }
      : {}),
    ...(circuitFallback ? { circuitFallback } : {}),
    requiredKw: Number(requiredKw.toFixed(2)),
    condensingHeatingReserveFactor:
      boilerRules.matching.condensingHeatingReserveFactor,
    heatingLoadKwCondensing: Number(heatingLoadKwCondensing.toFixed(2)),
    requiredKwForCondensingLine: Number(requiredKwCondensing.toFixed(2)),
    selected,
    warnings,
    resolvedRecommendations,
    recommendations,
    proposal,
    proposalEconomy,
    proposalEfficient,
    combustionTypeFilterApplied,
  };
}
