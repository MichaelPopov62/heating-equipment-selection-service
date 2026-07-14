/**
 * Назначение: оркестратор Pure Pipeline гидравлики.
 * Описание: граф → подбор труб → Δp → зоны циркуляции → насосы → отчёт.
 */

import { buildHydraulicsProposal } from './buildHydraulicsProposal.js';
import { buildHydraulicsGraph } from './buildGraph.js';
import { pickPipesForGraph } from './pickPipe.js';
import {
  buildConsumerSummaries,
  coarseRecommendedDn,
  computePressureReport,
  resolveDesignPumpFlowM3h,
} from './pressureDrop.js';
import { resolveSystemPumps } from './resolveSystemPumps.js';
import { thermalLoadToFlow } from './thermalLoadToFlow.js';

/**
 * @param {object} args
 * @param {import('./types.js').HydraulicsPipelineInput} args.dto
 * @param {import('../catalog/types.js').NormalizedCatalog} args.catalog
 * @returns {import('./types.js').HydraulicsPipelineResult}
 */
export function runHydraulicsPipeline({ dto, catalog }) {
  /** @type {string[]} */
  const notes = [];

  const graph = buildHydraulicsGraph(dto);
  const { pipes, warnings: pipeWarnings } = pickPipesForGraph({
    graph,
    catalog,
    dto,
  });

  const pressure = computePressureReport({ graph, pipes, dto });
  const pumpResult = resolveSystemPumps({ dto, pressure, catalog });
  const designFlow = resolveDesignPumpFlowM3h(dto);

  notes.push(...pumpResult.notes);

  const consumers = buildConsumerSummaries(dto);

  const pRad = dto.circuits.radiators?.consumers?.reduce(
    (s, c) => s + c.heatLoadWatts,
    0,
  ) ?? 0;
  const pUfh = dto.circuits.underfloor?.aggregate.heatLoadWatts ?? 0;
  const emittersMode = dto.meta.heatingEmittersMode;
  const primaryHeatWatts =
    emittersMode === 'mixed'
      ? pRad + pUfh
      : emittersMode === 'ufh_only'
        ? pUfh
        : pRad;

  const flowFromThermal = thermalLoadToFlow({
    heatLoadWatts: primaryHeatWatts,
    deltaTK: dto.source.deltaTK,
  });

  if (dto.layout.mainLineLengthM > 40) {
    notes.push(
      'Длинная магистраль: на реальном проекте обязательно считать сопротивления и насос.',
    );
  }

  const minBoilerKw =
    dto.circuits.underfloor?.isMixingNodeRequired
      ? 50
      : null;
  if (typeof minBoilerKw === 'number' && dto.source.requiredKw > minBoilerKw) {
    notes.push(
      'При такой расчётной мощности котлового контура рекомендуется гидравлический разделитель (гидрострелка) и проектная проработка коллекторной схемы.',
    );
  }

  if (dto.meta.heatingEmittersMode === 'ufh_only') {
    notes.push(
      'Расчёт магистрали выполнен по расходу подсистемы водяного теплого пола (underfloorHydraulics).',
    );
  }

  if (pumpResult.topology === 'direct' && dto.meta.heatingEmittersMode === 'mixed') {
    notes.push(
      'Смешанная система: расход котлового насоса = сумма расходов радиаторов и ТП.',
    );
  }

  if (pressure.criticalLoop) {
    notes.push(
      `Критическое циркуляционное кольцо: «${pressure.criticalLoop.label}» — Δp ${pressure.criticalPressureDropKPa ?? pressure.criticalLoop.pressureDropKPa} кПа (H≈${pressure.headRequiredM} м).`,
    );
  }

  for (const rec of pressure.balancingRecommendations ?? []) {
    notes.push(rec.hint);
  }

  /** @type {import('./types.js').HydraulicsReport} */
  const hydraulics = {
    schemaVersion: 1,
    inputs: {
      heatLoadWatts: primaryHeatWatts,
      deltaTSystemK: dto.source.deltaTK,
      mainLineLengthM: dto.layout.mainLineLengthM,
    },
    massFlowKgPerSec: flowFromThermal.massFlowKgPerSec,
    flowRateM3PerHour: designFlow || flowFromThermal.flowRateM3PerHour,
    boilerPumpDesignFlowM3PerHour: pumpResult.boilerPumpDesignFlowM3PerHour,
    circulationTopology: pumpResult.topology,
    recommendedPipeDiameter: coarseRecommendedDn(designFlow),
    recommendedVelocityRangeMPerSec: [
      dto.rules.velocityLimitsMps.mainMin,
      dto.rules.velocityLimitsMps.mainMax,
    ],
    consumers,
    graph,
    pressure,
    notes,
  };

  /** @type {import('./types.js').HydraulicsMatchingReport} */
  const hydraulicsMatching = {
    pipes,
    topology: pumpResult.topology,
    circulationZones: pumpResult.circulationZones,
    ...(pumpResult.pumps.length ? { pumps: pumpResult.pumps.map((p) => ({
      zoneId: p.zoneId,
      zoneLabel: p.zoneLabel,
      pumpRole: p.pumpRole,
      pumpSource: p.pumpSource,
      ...(p.catalogPumpId ? { catalogPumpId: p.catalogPumpId } : {}),
      ...(p.catalogBoilerId ? { catalogBoilerId: p.catalogBoilerId } : {}),
      modeName: p.modeName,
      headMarginPercent: p.headMarginPercent,
      designFlowM3PerHour: p.designFlowM3PerHour,
      headRequiredM: p.headRequiredM,
      headAtDesignM: p.headAtDesignM,
      ...(p.note ? { note: p.note } : {}),
      warnings: p.warnings,
    })) } : {}),
    ...(pumpResult.pump ? { pump: pumpResult.pump } : {}),
    ...(pumpResult.builtinPumpDuty ? { builtinPumpDuty: pumpResult.builtinPumpDuty } : {}),
    warnings: [...pipeWarnings, ...pumpResult.warnings],
  };

  hydraulicsMatching.proposal = buildHydraulicsProposal({
    matching: hydraulicsMatching,
    graph,
    pressure,
    catalog,
    pumpResult,
  });

  return { hydraulics, hydraulicsMatching };
}
