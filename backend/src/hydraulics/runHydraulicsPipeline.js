/**
 * Назначение: оркестратор Pure Pipeline гидравлики.
 * Описание: граф → подбор труб → Δp → насос → отчёт.
 */

import { buildHydraulicsGraph } from './buildGraph.js';
import { pickPipesForGraph } from './pickPipe.js';
import { pickPumpForSystem } from './pickPump.js';
import {
  buildConsumerSummaries,
  coarseRecommendedDn,
  computePressureReport,
  resolveDesignPumpFlowM3h,
} from './pressureDrop.js';
import { thermalLoadToFlow } from './thermalLoadToFlow.js';

/**
 * @param {object} args
 * @param {import('./types').HydraulicsPipelineInput} args.dto
 * @param {import('../catalog/types').NormalizedCatalog} args.catalog
 * @returns {import('./types').HydraulicsPipelineResult}
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
  const designFlow = resolveDesignPumpFlowM3h(dto);

  const { pump, warnings: pumpWarnings } = pickPumpForSystem({
    designFlowM3PerHour: designFlow,
    headRequiredM: pressure.headRequiredM,
    pumps: catalog.pumps ?? [],
    headMarginPercent: dto.rules.pumpHeadMarginPercent,
  });

  const consumers = buildConsumerSummaries(dto);

  const primaryHeatWatts =
    dto.circuits.underfloor?.aggregate.heatLoadWatts
    ?? dto.circuits.radiators?.consumers.reduce((s, c) => s + c.heatLoadWatts, 0)
    ?? 0;

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

  /** @type {import('./types').HydraulicsReport} */
  const hydraulics = {
    schemaVersion: 1,
    inputs: {
      heatLoadWatts: primaryHeatWatts,
      deltaTSystemK: dto.source.deltaTK,
      mainLineLengthM: dto.layout.mainLineLengthM,
    },
    massFlowKgPerSec: flowFromThermal.massFlowKgPerSec,
    flowRateM3PerHour: designFlow || flowFromThermal.flowRateM3PerHour,
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

  /** @type {import('./types').HydraulicsMatchingReport} */
  const hydraulicsMatching = {
    pipes,
    ...(pump ? { pump } : {}),
    warnings: [...pipeWarnings, ...pumpWarnings],
  };

  return { hydraulics, hydraulicsMatching };
}
