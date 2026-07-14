/**
 * Назначение: продуктовое предложение по гидравлике для клиента.
 * Описание: Обогащает matching.hydraulics данными каталога (brand, model, price).
 */

import { round } from '../utils/math.js';

/** @type {Record<string, string>} */
const SEGMENT_ROLE_LABELS = {
  main: 'Магистраль',
  trunk: 'Магистраль (последовательная)',
  branch: 'Ветка радиатора',
  ufh_collector_transit: 'Транзит коллектора ТП',
  ufh_loop: 'Петля ТП',
  dhw: 'ГВС',
};

/** @type {string} */
const MAIN_TRANSIT_ROLE_LABEL = 'Транзит котла';

/**
 * @param {import('./types.js').HydraulicsGraphEdge} edge
 * @param {Map<string, import('./types.js').HydraulicsGraphNode>} nodesById
 * @returns {string}
 */
function edgeSegmentLabel(edge, nodesById) {
  const from = nodesById.get(edge.from)?.label ?? edge.from;
  const to = nodesById.get(edge.to)?.label ?? edge.to;
  const role = edge.isMainLine === true
    ? MAIN_TRANSIT_ROLE_LABEL
    : (SEGMENT_ROLE_LABELS[edge.segmentRole] ?? edge.segmentRole);
  return `${role}: ${from} → ${to}`;
}

/**
 * @param {import('../catalog/types.js').NormalizedCatalog['pipes']} pipes
 * @param {string} catalogPipeId
 * @returns {import('../catalog/types.js').PipeCatalogItemNormalized | null}
 */
function findPipeInCatalog(pipes, catalogPipeId) {
  if (!pipes?.length || !catalogPipeId) return null;
  return pipes.find((p) => p.id === catalogPipeId) ?? null;
}

/**
 * @param {import('../catalog/types.js').NormalizedCatalog['pumps']} pumps
 * @param {string} catalogPumpId
 * @returns {import('../catalog/types.js').PumpCatalogItemNormalized | null}
 */
function findPumpInCatalog(pumps, catalogPumpId) {
  if (!pumps?.length || !catalogPumpId) return null;
  return pumps.find((p) => p.id === catalogPumpId) ?? null;
}

/**
 * @param {import('../catalog/types.js').NormalizedCatalog['boilers']} boilers
 * @param {string | undefined} catalogBoilerId
 * @returns {import('../catalog/types.js').BoilerCatalogItemNormalized | null}
 */
function findBoilerInCatalog(boilers, catalogBoilerId) {
  if (!catalogBoilerId || !boilers) return null;
  const all = [
    ...(boilers.doubleCircuit ?? []),
    ...(boilers.singleCircuit ?? []),
  ];
  return all.find((b) => {
    const id = /** @type {{ id?: string }} */ (b).id;
    return id === catalogBoilerId || b.model === catalogBoilerId;
  }) ?? null;
}

/**
 * @param {import('./types.js').HydraulicsPipeSegmentProposal[]} segments
 * @returns {import('./types.js').HydraulicsPipeProposalLine[]}
 */
function aggregatePipeLinesFromSegments(segments) {
  /** @type {Map<string, import('./types.js').HydraulicsPipeProposalLine>} */
  const aggregated = new Map();

  for (const seg of segments) {
    const prev = aggregated.get(seg.catalogPipeId);
    if (prev) {
      prev.totalLengthM = round(prev.totalLengthM + seg.lengthM, 2);
      prev.edgeCount += 1;
      prev.linePrice = round(prev.linePrice + seg.linePrice, 2);
    } else {
      aggregated.set(seg.catalogPipeId, {
        catalogPipeId: seg.catalogPipeId,
        brand: seg.brand,
        model: seg.model,
        material: seg.material,
        outerDiameterMm: seg.outerDiameterMm,
        wallThicknessMm: seg.wallThicknessMm,
        internalDiameterMm: seg.internalDiameterMm,
        totalLengthM: seg.lengthM,
        edgeCount: 1,
        pricePerMeter: seg.pricePerMeter,
        linePrice: seg.linePrice,
      });
    }
  }

  return [...aggregated.values()].sort((a, b) => b.totalLengthM - a.totalLengthM);
}

/**
 * @param {import('./types.js').HydraulicsPipeSegmentProposal[]} segments
 * @param {Set<string>} roles
 * @returns {import('./types.js').HydraulicsPipeProposalLine[]}
 */
function pipeLinesForRoles(segments, roles) {
  return aggregatePipeLinesFromSegments(
    segments.filter((seg) => roles.has(seg.segmentRole)),
  );
}

/**
 * @param {import('./types.js').HydraulicsResolvedPump} resolved
 * @param {import('../catalog/types.js').NormalizedCatalog} catalog
 * @returns {import('./types.js').HydraulicsPumpProposal}
 */
function buildPumpProposal(resolved, catalog) {
  if (resolved.pumpSource === 'boiler_builtin') {
    const boiler = findBoilerInCatalog(catalog.boilers, resolved.catalogBoilerId);
    return {
      zoneId: resolved.zoneId,
      zoneLabel: resolved.zoneLabel,
      pumpRole: resolved.pumpRole,
      pumpSource: 'boiler_builtin',
      ...(resolved.catalogBoilerId ? { catalogBoilerId: resolved.catalogBoilerId } : {}),
      brand: boiler?.model?.split(' ')[0] ?? 'Котёл',
      model: boiler?.model ?? 'Встроенный насос',
      price: 0,
      modeName: resolved.modeName,
      headAtDesignM: resolved.headAtDesignM,
      headRequiredM: resolved.headRequiredM,
      designFlowM3PerHour: resolved.designFlowM3PerHour,
      headMarginPercent: resolved.headMarginPercent,
      note: resolved.note ?? 'Используется встроенный насос котла.',
    };
  }

  const catalogPump = findPumpInCatalog(catalog.pumps, resolved.catalogPumpId ?? '');
  return {
    zoneId: resolved.zoneId,
    zoneLabel: resolved.zoneLabel,
    pumpRole: resolved.pumpRole,
    pumpSource: 'catalog',
    catalogPumpId: resolved.catalogPumpId ?? '',
    brand: catalogPump?.brand ?? '',
    model: catalogPump?.model ?? resolved.catalogPumpId ?? '',
    ...(catalogPump?.segment !== undefined ? { segment: catalogPump.segment } : {}),
    price: catalogPump?.price ?? 0,
    modeName: resolved.modeName,
    headAtDesignM: resolved.headAtDesignM,
    headRequiredM: resolved.headRequiredM,
    designFlowM3PerHour: resolved.designFlowM3PerHour,
    headMarginPercent: resolved.headMarginPercent,
    ...(catalogPump?.connections?.nominalDiameterMm !== undefined
      ? { connectionNominalMm: catalogPump.connections.nominalDiameterMm }
      : {}),
  };
}

/**
 * @param {object} args
 * @param {import('./types.js').HydraulicsMatchingReport} args.matching
 * @param {import('./types.js').HydraulicsGraph} args.graph
 * @param {import('./types.js').HydraulicsPressureReport} args.pressure
 * @param {import('../catalog/types.js').NormalizedCatalog} args.catalog
 * @param {import('./types.js').HydraulicsSystemPumpsResult} [args.pumpResult]
 * @returns {import('./types.js').HydraulicsProposalReport}
 */
export function buildHydraulicsProposal({
  matching,
  graph,
  pressure,
  catalog,
  pumpResult,
}) {
  /** @type {Map<string, import('./types.js').HydraulicsGraphNode>} */
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  /** @type {Map<string, import('./types.js').HydraulicsGraphEdge>} */
  const edgesById = new Map(graph.edges.map((e) => [e.id, e]));

  /** @type {import('./types.js').HydraulicsPipeSegmentProposal[]} */
  const pipeSegments = [];

  for (const pipeMatch of matching.pipes ?? []) {
    const edge = edgesById.get(pipeMatch.edgeId);
    const catalogPipe = findPipeInCatalog(catalog.pipes, pipeMatch.catalogPipeId);
    const lengthM = edge?.lengthM ?? 0;
    const pricePerMeter = catalogPipe?.price ?? 0;
    const linePrice = round(lengthM * pricePerMeter, 2);

    if (pipeMatch.catalogPoolExhausted) {
      continue;
    }

    pipeSegments.push({
      edgeId: pipeMatch.edgeId,
      segmentLabel: edge ? edgeSegmentLabel(edge, nodesById) : pipeMatch.edgeId,
      segmentRole: edge?.segmentRole ?? 'main',
      lengthM,
      catalogPipeId: pipeMatch.catalogPipeId,
      brand: catalogPipe?.brand ?? '',
      model: catalogPipe?.model ?? pipeMatch.catalogPipeId,
      material: catalogPipe?.material ?? '',
      outerDiameterMm: catalogPipe?.diameter ?? 0,
      wallThicknessMm: catalogPipe?.wallThickness ?? 0,
      internalDiameterMm: pipeMatch.internalDiameterMm,
      velocityMps: pipeMatch.velocityMps,
      pressureDropKPa: pipeMatch.pressureDropKPa,
      pricePerMeter,
      linePrice,
      ...(pipeMatch.velocityLimitExceeded
        ? { velocityLimitExceeded: true }
        : {}),
      ...(pipeMatch.velocityBelowMin ? { velocityBelowMin: true } : {}),
      ...(edge?.isMainLine === true ? { isMainLine: true } : {}),
      ...(pipeMatch.mainTransitGuardApplied
        ? { mainTransitGuardApplied: true }
        : {}),
      ...(pipeMatch.catalogPoolExhausted
        ? { catalogPoolExhausted: true }
        : {}),
      ...(edge?.to
        ? (() => {
          const toNode = nodesById.get(edge.to);
          return toNode?.roomIds?.length
            ? { groupedRoomIds: [...toNode.roomIds] }
            : {};
        })()
        : {}),
    });
  }

  const pipeLines = aggregatePipeLinesFromSegments(pipeSegments);

  const heatingRoles = new Set(['main', 'branch']);
  const ufhRoles = new Set(['ufh_collector_transit', 'ufh_loop']);

  /** @type {import('./types.js').HydraulicsPipeLineGroup[]} */
  const pipeLineGroups = [];

  const heatingLines = pipeLinesForRoles(pipeSegments, heatingRoles);
  if (heatingLines.length > 0) {
    pipeLineGroups.push({
      circuitId: 'heating',
      label: 'Контур отопления (радиаторы)',
      pipeLines: heatingLines,
      estimatedPrice: round(heatingLines.reduce((s, l) => s + l.linePrice, 0), 2),
    });
  }

  const ufhLines = pipeLinesForRoles(pipeSegments, ufhRoles);
  if (ufhLines.length > 0) {
    pipeLineGroups.push({
      circuitId: 'ufh',
      label: 'Контур тёплого пола',
      pipeLines: ufhLines,
      estimatedPrice: round(ufhLines.reduce((s, l) => s + l.linePrice, 0), 2),
    });
  }

  const estimatedPipesPrice = round(
    pipeLines.reduce((s, l) => s + l.linePrice, 0),
    2,
  );

  const resolvedPumps = pumpResult?.pumps ?? [];
  /** @type {import('./types.js').HydraulicsPumpProposal[]} */
  const pumpProposals = resolvedPumps.map((p) => buildPumpProposal(p, catalog));
  const estimatedPumpPrice = round(
    pumpProposals.reduce((s, p) => s + (p.price ?? 0), 0),
    2,
  );
  const mainPumpProposal =
    pumpProposals.find((p) => p.zoneId === 'boiler_primary') ?? pumpProposals[0];

  const designFlowM3PerHour =
    pumpResult?.boilerPumpDesignFlowM3PerHour
    ?? matching.pump?.designFlowM3PerHour
    ?? pipeSegments.reduce((max, s) => {
      const edge = edgesById.get(s.edgeId);
      return Math.max(max, edge?.designFlowM3PerHour ?? 0);
    }, 0);

  const headRequiredM = pressure.headRequiredM ?? matching.pump?.headRequiredM ?? 0;

  /** @type {string | undefined} */
  let unavailableReason;
  /** @type {string | undefined} */
  let pumpUnavailableReason;
  const hasAnyPump = pumpProposals.length > 0;
  const hasPipes = pipeSegments.length > 0;

  if (!hasPipes && !hasAnyPump) {
    unavailableReason = 'Не удалось подобрать трубы и насос из каталога.';
  } else if (!hasPipes) {
    unavailableReason = 'Трубы из каталога не подобраны — проверьте каталог pipes.';
  } else if (!hasAnyPump) {
    if (matching.builtinPumpDuty?.status === 'below_manufacturer_qmin') {
      pumpUnavailableReason =
        `Встроенный насос котла учтён: расход ${matching.builtinPumpDuty.designFlowM3PerHour} м³/ч `
        + `ниже заводского q_min=${matching.builtinPumpDuty.heatingCircuitMinFlowM3h} м³/ч — `
        + 'отдельный насос из каталога не подбирается.';
    } else {
      pumpUnavailableReason =
        'Насос из каталога не подобран для расчётной рабочей точки — см. предупреждения.';
    }
  }

  return {
    designFlowM3PerHour: round(designFlowM3PerHour, 3),
    headRequiredM: round(headRequiredM, 2),
    ...(matching.topology ? { topology: matching.topology } : {}),
    ...(matching.circulationZones?.length
      ? { circulationZones: matching.circulationZones }
      : {}),
    pipeLines,
    ...(pipeLineGroups.length ? { pipeLineGroups } : {}),
    pipeSegments,
    ...(mainPumpProposal ? { pump: mainPumpProposal } : {}),
    ...(pumpProposals.length ? { pumps: pumpProposals } : {}),
    estimatedPipesPrice,
    estimatedPumpPrice,
    estimatedTotalPrice: round(estimatedPipesPrice + estimatedPumpPrice, 2),
    ...(unavailableReason ? { unavailableReason } : {}),
    ...(pumpUnavailableReason ? { pumpUnavailableReason } : {}),
  };
}
