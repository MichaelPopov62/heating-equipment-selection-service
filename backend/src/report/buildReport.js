/**
 * Назначение: сборка финального JSON-отчёта расчёта.
 * Описание: Оркестрирует пайплайн: климат, теплопотери, ГВС, подбор оборудования (matchEquipment),
 * резолв схемы ТП, подбор коллекторов (pickManifolds), гидравлика и рекомендации.
 */

import { getDesignOutsideTempC } from '../climate/index.js';
import { calculateHeatLossForBuilding } from '../logic/heatlossByRooms.js';
import { calculateUnderfloorHeating } from '../logic/warmFloorCalc.js';
import { enrichUnderfloorHeatingLoopHydraulics, applyUfhLoopHydraulicsRecommendations } from '../logic/ufhLoopHydraulics.js';
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
import {
  matchEquipment,
  pickManifolds,
  pickUniboxes,
  buildEmptyManifoldsFailure,
} from '../matching/public.js';
import { pushRecommendation } from '../recommendations/recommendationResolver.js';
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
 * Структурированные WARN_* / REC_* по подбору труб pipeline.
 * @param {object} args
 * @param {import('../hydraulics/types').HydraulicsMatchingReport} args.hydraulicsMatching
 * @param {import('../types/shared-types').HydraulicsReport} args.hydraulics
 * @param {import('../appliances/types').HydraulicsApplianceRules} args.hydraulicsRules
 * @param {string[]} args.warnings
 * @param {import('../recommendations/types').RecommendationsBundle} args.recommendations
 * @returns {import('../recommendations/types').ResolvedRecommendation[]}
 */
function applyHydraulicsPipeRecommendations({
  hydraulicsMatching,
  hydraulics,
  hydraulicsRules,
  warnings,
  recommendations,
}) {
  /** @type {import('../recommendations/types').ResolvedRecommendation[]} */
  const resolved = [];
  const edgesById = new Map(
    (hydraulics.graph?.edges ?? []).map((edge) => [edge.id, edge]),
  );
  const nodesById = new Map(
    (hydraulics.graph?.nodes ?? []).map((node) => [node.id, node]),
  );

  for (const pipe of hydraulicsMatching.pipes ?? []) {
    const edge = edgesById.get(pipe.edgeId);
    const vMax =
      edge?.isMainLine === true || edge?.segmentRole === 'main'
        ? hydraulicsRules.velocityLimitsMps.mainMax
        : hydraulicsRules.velocityLimitsMps.branchMax;
    const vMin =
      edge?.isMainLine === true
        ? hydraulicsRules.velocityLimitsMps.mainMin
        : edge?.segmentRole === 'main'
          ? hydraulicsRules.velocityLimitsMps.mainMin
          : (hydraulicsRules.velocityLimitsMps.branchMin ?? 0);

    if (pipe.catalogPoolExhausted) {
      const minInternal = edge?.isMainLine === true
        ? hydraulicsRules.mainTransitMinInternalDiameterMm
        : hydraulicsRules.branchMinInternalDiameterMm;
      pushRecommendation(
        warnings,
        resolved,
        recommendations,
        'WARN_PIPE_CATALOG_NO_INTERNAL_DIAMETER',
        {
          edgeId: pipe.edgeId,
          minInternalDiameterMm: minInternal,
        },
      );
      continue;
    }

    if (pipe.velocityLimitExceeded) {
      pushRecommendation(
        warnings,
        resolved,
        recommendations,
        'WARN_PIPE_VELOCITY_EXCEEDED',
        {
          edgeId: pipe.edgeId,
          velocityMps: Math.round(pipe.velocityMps * 100) / 100,
          velocityMaxMps: vMax,
          catalogPipeId: pipe.catalogPipeId,
        },
      );
    } else if (pipe.velocityBelowMin) {
      if (pipe.mainTransitGuardApplied) {
        pushRecommendation(
          warnings,
          resolved,
          recommendations,
          'WARN_PIPE_MAIN_TRANSIT_LOW_VELOCITY',
          {
            edgeId: pipe.edgeId,
            velocityMps: Math.round(pipe.velocityMps * 100) / 100,
            velocityMinMps: vMin,
            catalogPipeId: pipe.catalogPipeId,
            minInternalDiameterMm: hydraulicsRules.mainTransitMinInternalDiameterMm,
          },
        );
      } else {
        pushRecommendation(
          warnings,
          resolved,
          recommendations,
          'WARN_PIPE_VELOCITY_BELOW_MIN',
          {
            edgeId: pipe.edgeId,
            velocityMps: Math.round(pipe.velocityMps * 100) / 100,
            velocityMinMps: vMin,
            catalogPipeId: pipe.catalogPipeId,
          },
        );
      }
    } else if (pipe.mainTransitGuardApplied) {
      pushRecommendation(
        warnings,
        resolved,
        recommendations,
        'REC_PIPE_MAIN_TRANSIT_GUARD_APPLIED',
        {
          edgeId: pipe.edgeId,
          catalogPipeId: pipe.catalogPipeId,
          internalDiameterMm: pipe.internalDiameterMm,
          minInternalDiameterMm: hydraulicsRules.mainTransitMinInternalDiameterMm,
        },
      );
    }
  }

  for (const node of nodesById.values()) {
    if (node.kind !== 'radiator_manifold' || !node.roomIds?.length) continue;
    const manifoldEdge = (hydraulics.graph?.edges ?? []).find(
      (e) => e.to === node.id && e.segmentRole === 'branch',
    );
    pushRecommendation(
      warnings,
      resolved,
      recommendations,
      'REC_RADIATOR_MICRO_BRANCH_MANIFOLD',
      {
        roomCount: node.roomIds.length,
        roomNames: node.label,
        totalFlowM3PerHour: manifoldEdge?.designFlowM3PerHour ?? 0,
      },
    );
  }

  const builtinDuty = hydraulicsMatching.builtinPumpDuty;
  if (builtinDuty?.status === 'below_manufacturer_qmin') {
    pushRecommendation(
      warnings,
      resolved,
      recommendations,
      'WARN_BOILER_HEATING_FLOW_BELOW_MIN',
      {
        designFlowM3PerHour: builtinDuty.designFlowM3PerHour,
        qMinM3h: builtinDuty.heatingCircuitMinFlowM3h,
        catalogBoilerModel: builtinDuty.catalogBoilerModel ?? builtinDuty.catalogBoilerId ?? 'котёл',
      },
    );
  }

  return resolved;
}

/**
 * @param {object} args
 * @param {import('../types/shared-types').CalcRequestBody} args.input
 * @param {import('../types/shared-types').CalcRuntimeContext} args.ctx
 * @returns {Promise<import('../types/shared-types').CalcReport>}
 */
export async function buildReport({ input, ctx }) {
  assertCalcRuntimeContext(ctx);
  const {
    catalog,
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
    ...(typeof inputTemps?.bathroomAirTempC === 'number' &&
    Number.isFinite(inputTemps.bathroomAirTempC)
      ? { bathroomAirTempC: inputTemps.bathroomAirTempC }
      : {}),
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

  // Прокинути bathroomAirTempC у building.temps (радіатори / shared resolve).
  if (input.building && typeof temps.bathroomAirTempC === 'number') {
    const bt = input.building.temps ?? { insideC: temps.insideC };
    input.building.temps = {
      ...bt,
      insideC: bt.insideC ?? temps.insideC,
      bathroomAirTempC: temps.bathroomAirTempC,
    };
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
    enrichUnderfloorHeatingLoopHydraulics(underfloorHeating, {
      catalog,
      hydraulicsRules: appliances.byKind.hydraulics,
      materialPreference: input.hydraulics?.pipeMaterialPreference,
    });
    applyUfhLoopHydraulicsRecommendations(
      underfloorHeating,
      recommendations,
      appliances.byKind.hydraulics,
    );
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
    hydraulics: input.hydraulics,
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

  // 4b) Підбір колекторів — soft-fail: не валимо весь report
  /** @type {import('../types/shared-types').ManifoldsMatchingReport} */
  let manifoldsReport;
  try {
    manifoldsReport = pickManifolds({
      catalog: ctx.catalog,
      building: input.building,
      underfloorHeating,
      radiators: matching.radiators,
      boiler: matching.boiler,
      hydraulics: input.hydraulics,
    });
  } catch (err) {
    // Страховка, якщо контракт модуля порушено (pickManifolds не повинен кидати)
    logger.warn('matching.manifold.throw', err, { code: 'MANIFOLD_INTERNAL' });
    manifoldsReport = buildEmptyManifoldsFailure({
      failureCode: 'MANIFOLD_INTERNAL',
      message:
        'Смета коллекторов пуста; расчёт унибоксов и гидравлики продолжается.',
      causeMessage: err?.message ? String(err.message) : undefined,
    });
  }

  if (!manifoldsReport || typeof manifoldsReport.ok !== 'boolean') {
    logger.warn('matching.manifold.invalid_shape', null, {
      shape: manifoldsReport == null ? 'null' : typeof manifoldsReport,
    });
    manifoldsReport = buildEmptyManifoldsFailure({
      failureCode: 'MANIFOLD_INTERNAL',
      message: 'Некорректный ответ подбора коллекторов.',
    });
  }

  matching.manifolds = manifoldsReport;

  if (manifoldsReport.ok === false) {
    logger.info('report.matching.manifolds.degraded', null, {
      failureCode: manifoldsReport.failureCode ?? null,
      warnings: manifoldsReport.warnings?.length ?? 0,
    });
  }

  // 4c) Підбір унібоксів — завжди після колекторів (навіть при ok: false)
  const roomAirTempC =
    typeof input.temps?.insideC === 'number'
      ? input.temps.insideC
      : typeof input.building?.temps?.insideC === 'number'
        ? input.building.temps.insideC
        : undefined;
  matching.uniboxes = pickUniboxes({
    catalog: ctx.catalog,
    underfloorHeating,
    roomAirTempC,
    bathroomAirTempC:
      typeof temps.bathroomAirTempC === 'number' ? temps.bathroomAirTempC : undefined,
    manifolds: matching.manifolds,
    rooms: input.building?.rooms,
  });

  logger.info('report.matching.done', null, {
    boilerModel: matching?.boiler?.selected?.model ?? null,
    requiredBoilerKw: matching?.boiler?.requiredKw ?? null,
    radiatorModel: matching?.radiators?.chosen?.model ?? null,
    waterHeaterModel: matching?.waterHeater?.selected?.model ?? null,
    indirectWaterHeaterModel: matching?.indirectWaterHeater?.selected?.model ?? null,
    waterHeaterVolumeLiters: matching?.waterHeater?.chosenVariant?.volumeLiters ?? null,
    manifoldsOk: matching?.manifolds?.ok ?? null,
    manifoldsFailureCode: matching?.manifolds?.failureCode ?? null,
    manifoldUnderfloorCount: matching?.manifolds?.underfloor?.length ?? 0,
    manifoldUnderfloorUnits:
      matching?.manifolds?.underfloor?.reduce((s, f) => s + (f.units?.length ?? 0), 0) ?? 0,
    manifoldRadiatorModel: matching?.manifolds?.radiator?.selected?.model ?? null,
    boilerManifoldModel: matching?.manifolds?.boilerManifold?.selected?.model ?? null,
    uniboxLoopCount: matching?.uniboxes?.byLoop?.length ?? 0,
    uniboxSelectedCount:
      matching?.uniboxes?.byLoop?.filter((row) => row.selected)?.length ?? 0,
    warnings: (matching?.boiler?.warnings?.length ?? 0)
      + (matching?.radiators?.warnings?.length ?? 0)
      + (matching?.waterHeater?.warnings?.length ?? 0)
      + (matching?.indirectWaterHeater?.warnings?.length ?? 0)
      + (matching?.manifolds?.warnings?.length ?? 0)
      + (matching?.uniboxes?.warnings?.length ?? 0),
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
    const hydraulicsResolved = applyHydraulicsPipeRecommendations({
      hydraulicsMatching: pipelineResult.hydraulicsMatching,
      hydraulics: pipelineResult.hydraulics,
      hydraulicsRules: appliances.byKind.hydraulics,
      warnings,
      recommendations,
    });
    if (hydraulicsResolved.length) {
      matching.hydraulics.resolvedRecommendations = hydraulicsResolved;
    }
    if (pipelineResult.hydraulicsMatching.warnings?.length) {
      warnings.push(...pipelineResult.hydraulicsMatching.warnings);
    }
  } catch (hydErr) {
    logger.warn('report.hydraulics.fail', hydErr, {
      code: hydErr?.code ?? null,
    });
    const hydraulicsFailMessage =
      hydErr?.message
        ? `Гидравлика: ${hydErr.message}`
        : 'Гидравлика: не удалось выполнить pipeline.';
    warnings.push(hydraulicsFailMessage);
    hydraulics = {
      schemaVersion: 1,
      notes: ['Расчёт гидравлики pipeline не выполнен — см. warnings.'],
    };
    matching.hydraulics = {
      proposal: {
        designFlowM3PerHour: 0,
        headRequiredM: 0,
        pipeLines: [],
        pipeSegments: [],
        pumps: [],
        estimatedPipesPrice: 0,
        estimatedPumpPrice: 0,
        estimatedTotalPrice: 0,
        unavailableReason: hydErr?.message ?? 'Расчёт гидравлики не выполнен.',
      },
      warnings: [hydraulicsFailMessage],
      pipes: [],
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
    ...(matching.manifolds?.warnings ?? []),
    ...(matching.uniboxes?.warnings ?? []),
    ...(matching.hydraulics?.warnings ?? []),
  ];

  /** @type {import('../recommendations/types').ResolvedRecommendation[]} */
  const reportRecommendations = [
    ...(matching.boiler?.resolvedRecommendations ?? []),
    ...(matching.indirectWaterHeater?.resolvedRecommendations ?? []),
    ...(underfloorHeating?.resolvedRecommendations ?? []),
    ...(matching.radiators?.resolvedRecommendations ?? []),
    ...(matching.hydraulics?.resolvedRecommendations ?? []),
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

