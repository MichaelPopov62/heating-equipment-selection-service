/**
 * Назначение: сборка финального JSON-отчёта расчёта.
 * Описание: Оркестрирует пайплайн: климат, теплопотери, ГВС, гидравлика, подбор оборудования (matching/public.js) и рекомендации. Формирует meta, input, calculations, matching и warnings. Экспортирует buildReport(); вызывается из api/runCalculation.js.
 */

import { getDesignOutsideTempC } from '../climate/index.js';
import { calculateHeatLossForBuilding } from '../logic/heatlossByRooms.js';
import { calculateUnderfloorHeating } from '../logic/warmFloorCalc.js';
import {
  applyUnderfloorHeatingRecommendations,
  applyUnderfloorMixingDistributionRecommendations,
  buildWarmFloorCalcMatchingNotes,
} from '../matching/warmFloor.js';
import { calculateHotWaterDemand } from '../logic/hotWater.js';
import {
  buildHydraulicsSnapshots,
  runHydraulicsPipeline,
  validateHydraulicsPipelineInput,
} from '../hydraulics/public.js';
import { resolveUfhDistributionWithAppliances } from '../logic/ufhDistributionResolve.js';
import { computeUfhMixingNodeSpec } from '../logic/ufhMixingNodeHydraulics.js';
import { matchEquipment } from '../matching/public.js';
import { assertCalcRuntimeContext } from '../reference/assertCalcRuntimeContext.js';
import { logger } from '../utils/logger.js';
import { buildMatchingAutomationHints } from './automationHints.js';
import { recommendedApartmentElectricTankLiters, recommendedCombiBufferTankLiters, recommendedSingleCircuitBufferTankLiters } from '../utils/apartmentMatching.js';
import {
  appendApartmentCombiSerialBufferAutomationHint,
  appendApartmentSingleOversizeCombiHint,
} from '../utils/apartmentCombiSerialBufferHint.js';
import {
  SCHEME_BOILER_COMBI_BUFFER_ELECTRIC,
  SCHEME_BOILER_ELECTRIC_SEPARATE,
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
} from '../../../shared/heatingMatchingSchemes.js';

/**
 * @param {object} args
 * @param {import('../types/shared-types').CalcRequestBody} args.input
 * @param {import('../types/shared-types').CalcRuntimeContext} args.ctx
 * @returns {Promise<import('../types/shared-types').CalcReport>}
 */
export async function buildReport({ input, ctx }) {
  assertCalcRuntimeContext(ctx);
  const {
    waterNorms,
    appliances,
    recommendations,
    ufhPresets,
    sources,
  } = ctx;
  const catalogSource = sources.catalog;
  const waterNormsSource = sources.waterNorms;
  const appliancesSource = sources.appliances;
  const recommendationsSource = sources.recommendations;
  const ufhPresetsSource = sources.ufhPresets;
  const referenceBundleLoadedAt = sources.loadedAt;
  const ufhPresetsSchemaVersion = ufhPresets.schemaVersion;
  const warnings = [];
  logger.info('report.build.start', null);

  // 1) Клімат / розрахункова зовнішня температура
  let climate = null;
  const inputTemps = input.building?.temps ?? input.temps ?? null;
  if (input.location && inputTemps?.outsideC == null) {
    logger.info('report.climate.start', null, { hasLocation: true });
    climate = await getDesignOutsideTempC(input.location);
    if (climate?.designOutsideTempC == null) {
      warnings.push(
        'Не удалось определить расчётную наружную температуру по геолокации — задайте temps.outsideC вручную.',
      );
    }
  }

  const temps = {
    insideC: inputTemps?.insideC,
    outsideC: inputTemps?.outsideC ?? climate?.designOutsideTempC,
  };
  if (temps.insideC == null) {
    const err = new Error('Не задана внутренняя температура building.temps.insideC.');
    err.statusCode = 400;
    err.code = 'INSIDE_TEMP_REQUIRED';
    throw err;
  }
  if (temps.outsideC == null) {
    const err = new Error('Не задана наружная температура temps.outsideC и не получен климат.');
    err.statusCode = 400;
    err.code = 'OUTSIDE_TEMP_REQUIRED';
    throw err;
  }

  // 2) Теплопотери (по комнатам/элементам)
  logger.info('report.heatloss.start', null, {
    rooms: input.building?.rooms?.length ?? 0,
    elements: input.building?.envelopeElements?.length ?? 0,
  });
  const heatLoss = calculateHeatLossForBuilding({
    temps,
    building: input.building,
  });
  logger.info('report.heatloss.done', null, { totalWatts: heatLoss.totalWatts });

  // 2b) Водяной тёплый пол — теплоотдача вверх/вниз, Tповерх
  const underfloorHeating = calculateUnderfloorHeating({
    temps,
    building: input.building,
    heatingSystem: input.heatingSystem,
    heatLoss,
    ufhPresets,
    maxUfhLoopLengthM: appliances.byKind.hydraulics.maxUfhLoopLengthM,
  });
  if (underfloorHeating?.rooms?.length) {
    applyUnderfloorHeatingRecommendations(underfloorHeating, recommendations);
    logger.info('report.underfloorHeating.done', null, {
      rooms: underfloorHeating.rooms.length,
      totalHeatFluxUpWatts: underfloorHeating.totalHeatFluxUpWatts,
    });
  }

  // 3) Гаряче водопостачання (ГВП) — тип объекта влияет на нормы и одновременность
  const objectType = input.building?.objectMeta?.objectType;
  const objectTypeNorm =
    objectType === 'apartment' || objectType === 'house' ? objectType : 'house';

  const activeScheme =
    input.heatingSystem?.hotWaterBoilerPowerMatchingScheme ??
    SCHEME_BOILER_MAX_COMBI;
  const hsRecord =
    input.heatingSystem && typeof input.heatingSystem === 'object'
      ? /** @type {Record<string, unknown>} */ (input.heatingSystem)
      : null;
  const apartmentIndirectStorage =
    hsRecord?._apartmentIndirectDhwStorage === true &&
    activeScheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM &&
    objectTypeNorm === 'apartment';

  /** @type {{ dhwSupplyScenarioOverride?: 'flowThrough' | 'storage' }} */
  const hotWaterOptions = apartmentIndirectStorage
    ? { dhwSupplyScenarioOverride: 'storage' }
    : objectTypeNorm === 'apartment' &&
        activeScheme === SCHEME_BOILER_ELECTRIC_SEPARATE
      ? { dhwSupplyScenarioOverride: 'storage' }
      : {};

  let hotWaterInitial = calculateHotWaterDemand(
    {
      ...(input.hotWater ?? {}),
      objectType: objectTypeNorm,
    },
    waterNorms,
    hotWaterOptions,
  );

  if (
    objectTypeNorm === 'apartment' &&
    activeScheme === SCHEME_BOILER_ELECTRIC_SEPARATE
  ) {
    const tankLiters = recommendedApartmentElectricTankLiters(
      waterNorms,
      hotWaterInitial.residents ?? 0,
    );
    hotWaterInitial = {
      ...hotWaterInitial,
      recommendedTankLiters: tankLiters,
    };
  }

  if (activeScheme === SCHEME_BOILER_COMBI_BUFFER_ELECTRIC) {
    const tankLiters = recommendedCombiBufferTankLiters(
      waterNorms,
      hotWaterInitial.residents ?? 0,
    );
    hotWaterInitial = {
      ...hotWaterInitial,
      recommendedTankLiters: tankLiters,
    };
  }

  if (activeScheme === SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC) {
    const tankLiters = recommendedSingleCircuitBufferTankLiters(
      waterNorms,
      hotWaterInitial.residents ?? 0,
    );
    hotWaterInitial = {
      ...hotWaterInitial,
      recommendedTankLiters: tankLiters,
      dhwSupplyScenario: 'storage',
    };
  }
  logger.info('report.hotwater.done', null, {
    hotWaterPowerKw: hotWaterInitial?.hotWaterPowerKw ?? null,
    recommendedTankLiters: hotWaterInitial?.recommendedTankLiters ?? null,
    peakFlowLps: hotWaterInitial?.peakFlowLps ?? null,
  });

  const isUfhOnly = input.heatingSystem?.heatingEmittersMode === 'ufh_only';
  const heatingReserveFactor =
    appliances.byKind.boiler.matching.heatingReserveFactor;
  const heatingBaseKw =
    isUfhOnly && underfloorHeating?.totalHeatFluxUpWatts
      ? underfloorHeating.totalHeatFluxUpWatts / 1000
      : heatLoss.totalWatts / 1000;

  const automationHints = buildMatchingAutomationHints({
    objectType: objectTypeNorm,
    hotWaterReport: hotWaterInitial,
    activeScheme,
    building: input.building,
    heatingLoadKw: heatingBaseKw * heatingReserveFactor,
    apartmentClassification: appliances.byKind.boiler.apartmentClassification,
  });

  // 4) Подбор оборудования
  logger.info('report.matching.start', null);
  const { matching, hotWaterForCalculations } = matchEquipment({
    heatLoss,
    hotWater: hotWaterInitial,
    heatingSystem: input.heatingSystem ?? {},
    building: input.building,
    underfloorHeating,
    ctx,
  });

  const hotWater = hotWaterForCalculations ?? hotWaterInitial;

  if (underfloorHeating?.rooms?.length && matching.radiators) {
    matching.radiators.radiatorSelectionNotes = [
      ...(matching.radiators.radiatorSelectionNotes ?? []),
      ...buildWarmFloorCalcMatchingNotes(underfloorHeating),
    ];
  }

  appendApartmentCombiSerialBufferAutomationHint(automationHints, {
    objectType: objectTypeNorm,
    requestedScheme: activeScheme,
    circuitFallback: matching.boiler?.circuitFallback ?? null,
    hotWaterReport: hotWater,
    serialBufferConfig: appliances.byKind.boiler.hints.apartmentCombiSerialBuffer,
    recommendations,
  });

  appendApartmentSingleOversizeCombiHint(automationHints, {
    objectType: objectTypeNorm,
    requestedScheme: activeScheme,
    circuitFallback: matching.boiler?.circuitFallback ?? null,
    resolvedRecommendations: matching.boiler?.resolvedRecommendations ?? [],
    recommendations,
  });

  const reqBoilerKw = matching.boiler?.requiredKw;

  if (underfloorHeating?.isMixingNodeRequired) {
    const requestedPreset =
      input.heatingSystem?.underfloorDistributionPreset ?? 'auto';
    const ufhAppliance = appliances.byKind.underfloor_heating;
    const minBoilerKw = ufhAppliance.distribution.autoHydraulicSeparatorMinBoilerKw;
    const resolvedPreset = resolveUfhDistributionWithAppliances(
      requestedPreset,
      {
        objectType: input.building?.objectMeta?.objectType,
        roomsWithUfhCount: underfloorHeating.rooms?.length ?? 0,
        requiredBoilerKw: reqBoilerKw,
      },
      appliances,
    );
    const prevPreset = underfloorHeating.distributionPreset;
    underfloorHeating.distributionPreset = resolvedPreset;

    if (
      (requestedPreset === 'auto' || requestedPreset == null)
      && typeof reqBoilerKw === 'number'
      && reqBoilerKw > minBoilerKw
      && resolvedPreset === 'hydraulic_separator'
      && prevPreset !== 'hydraulic_separator'
    ) {
      underfloorHeating.warnings = [
        ...(underfloorHeating.warnings ?? []),
        `Схема ТП (авто): при мощности котла > ${minBoilerKw} кВт выбрана гидравлическая стрелка.`,
      ];
    }

    const primaryRoom = underfloorHeating.rooms?.[0];
    underfloorHeating.mixingNode = computeUfhMixingNodeSpec({
      powerKw: (underfloorHeating.totalHeatFluxUpWatts ?? 0) / 1000,
      deltaTK: ufhAppliance.mixingNode.deltaTK,
      distributionPreset: resolvedPreset,
      mixingNodeRules: ufhAppliance.mixingNode,
    });
    underfloorHeating.mixingNode.boilerSupplyC = input.heatingSystem?.supplyC;
    underfloorHeating.mixingNode.floorCircuitSupplyC = primaryRoom?.circuitSupplyC;

    applyUnderfloorMixingDistributionRecommendations(
      underfloorHeating,
      {
        requestedPreset,
        resolvedPreset,
        minBoilerKw,
        requiredBoilerKw: reqBoilerKw,
      },
      recommendations,
    );
  }

  logger.info('report.matching.done', null, {
    boilerModel: matching?.boiler?.selected?.model ?? null,
    requiredBoilerKw: matching?.boiler?.requiredKw ?? null,
    radiatorModel: matching?.radiators?.chosen?.model ?? null,
    waterHeaterModel: matching?.waterHeater?.selected?.model ?? null,
    indirectWaterHeaterModel: matching?.indirectWaterHeater?.selected?.model ?? null,
    waterHeaterVolumeLiters: matching?.waterHeater?.chosenVariant?.volumeLiters ?? null,
    warnings: (matching?.boiler?.warnings?.length ?? 0)
      + (matching?.radiators?.warnings?.length ?? 0)
      + (matching?.waterHeater?.warnings?.length ?? 0)
      + (matching?.indirectWaterHeater?.warnings?.length ?? 0),
  });

  // 5) Гидравлика Pure Pipeline (после matching)
  logger.info('report.hydraulics.start', null);
  /** @type {import('../types/shared-types').HydraulicsReport} */
  let hydraulics;
  try {
    const pipelineDto = buildHydraulicsSnapshots({
      input,
      hotWater,
      underfloorHeating,
      matching,
      hydraulicsRules: appliances.byKind.hydraulics,
    });
    await validateHydraulicsPipelineInput(pipelineDto);
    const pipelineResult = runHydraulicsPipeline({
      dto: pipelineDto,
      catalog: ctx.catalog,
    });
    hydraulics = pipelineResult.hydraulics;
    matching.hydraulics = pipelineResult.hydraulicsMatching;
    if (pipelineResult.hydraulicsMatching.warnings?.length) {
      warnings.push(...pipelineResult.hydraulicsMatching.warnings);
    }
  } catch (hydErr) {
    logger.warn('report.hydraulics.fail', hydErr, {
      code: hydErr?.code ?? null,
    });
    warnings.push(
      hydErr?.message
        ? `Гидравлика: ${hydErr.message}`
        : 'Гидравлика: не удалось выполнить pipeline.',
    );
    hydraulics = {
      schemaVersion: 1,
      notes: ['Расчёт гидравлики pipeline не выполнен — см. warnings.'],
    };
  }
  logger.info('report.hydraulics.done', null, {
    flowRateM3PerHour: hydraulics?.flowRateM3PerHour ?? null,
    headRequiredM: hydraulics?.pressure?.headRequiredM ?? null,
  });

  const allWarnings = [
    ...warnings,
    ...(underfloorHeating?.warnings ?? []),
    ...(matching.boiler?.warnings ?? []),
    ...(matching.radiators?.warnings ?? []),
    ...(matching.waterHeater?.warnings ?? []),
    ...(matching.indirectWaterHeater?.warnings ?? []),
    ...(matching.hydraulics?.warnings ?? []),
  ];

  /** @type {import('../recommendations/types').ResolvedRecommendation[]} */
  const reportRecommendations = [
    ...(matching.boiler?.resolvedRecommendations ?? []),
    ...(matching.indirectWaterHeater?.resolvedRecommendations ?? []),
    ...(underfloorHeating?.resolvedRecommendations ?? []),
  ];

  /** Внутренние флаги нормализации не попадают в echo input отчёта. */
  const inputForReport = structuredClone(input);
  if (
    inputForReport.heatingSystem &&
    typeof inputForReport.heatingSystem === 'object'
  ) {
    const hsClean = /** @type {Record<string, unknown>} */ ({
      ...inputForReport.heatingSystem,
    });
    delete hsClean._apartmentIndirectDhwStorage;
    delete hsClean._normalizationWarnings;
    delete hsClean._thermalRegimeAutoAdjusted;
    inputForReport.heatingSystem =
      /** @type {import('../types/shared-types').HeatingSystemInput} */ (hsClean);
  }

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      schemaVersion: 1,
      catalogSource,
      waterNormsSource,
      waterNormsSchemaVersion: waterNorms.schemaVersion,
      appliancesSource,
      appliancesSchemaVersions: appliances.schemaVersions,
      ...(typeof referenceBundleLoadedAt === 'number' && Number.isFinite(referenceBundleLoadedAt)
        ? { referenceBundleLoadedAt: new Date(referenceBundleLoadedAt).toISOString() }
        : {}),
      recommendationsSource,
      ufhPresetsSource,
      ufhPresetsSchemaVersion,
      automationHints,
    },
    input: inputForReport,
    climate,
    temps,
    calculations: {
      heatLoss,
      hotWater,
      hydraulics,
      underfloorHeating: underfloorHeating ?? null,
    },
    matching,
    recommendations: reportRecommendations.length ? reportRecommendations : undefined,
    warnings: allWarnings,
  };
}

