/**
 * Назначение: парсинг matching.hydraulics.proposal из отчёта calc API.
 */

import type {
  ParsedHydraulicsPipeLine,
  ParsedHydraulicsPipeLineGroup,
  ParsedHydraulicsPipeSegment,
  ParsedHydraulicsProposal,
  ParsedHydraulicsPumpProposal,
} from '../types/hydraulics';

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function parsePumpRole(v: unknown): ParsedHydraulicsPumpProposal['pumpRole'] {
  if (v === 'main' || v === 'zone' || v === 'dhw') return v;
  return 'main';
}

function parsePumpSource(v: unknown): ParsedHydraulicsPumpProposal['pumpSource'] {
  if (v === 'catalog' || v === 'boiler_builtin') return v;
  return 'catalog';
}

function parseTopology(
  v: unknown,
): ParsedHydraulicsProposal['topology'] | undefined {
  if (v === 'direct' || v === 'mixing_valve' || v === 'hydraulic_separator') {
    return v;
  }
  return undefined;
}

function parsePump(raw: unknown): ParsedHydraulicsPumpProposal | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const pumpSource = parsePumpSource(p.pumpSource);
  const catalogPumpId = str(p.catalogPumpId);
  if (pumpSource === 'catalog' && !catalogPumpId) return null;
  if (!str(p.modeName)) return null;

  return {
    zoneId: str(p.zoneId) || 'boiler_primary',
    zoneLabel: str(p.zoneLabel) || 'Циркуляционный насос',
    pumpRole: parsePumpRole(p.pumpRole),
    pumpSource,
    ...(catalogPumpId ? { catalogPumpId } : {}),
    ...(typeof p.catalogBoilerId === 'string' ? { catalogBoilerId: p.catalogBoilerId } : {}),
    brand: str(p.brand),
    model: str(p.model) || catalogPumpId || str(p.zoneLabel),
    segment:
      p.segment === 'premium' || p.segment === 'medium' || p.segment === 'budget'
        ? p.segment
        : undefined,
    price: num(p.price),
    modeName: str(p.modeName),
    headAtDesignM: num(p.headAtDesignM),
    headRequiredM: num(p.headRequiredM),
    designFlowM3PerHour: num(p.designFlowM3PerHour),
    headMarginPercent: num(p.headMarginPercent),
    connectionNominalMm:
      typeof p.connectionNominalMm === 'number' ? p.connectionNominalMm : undefined,
    note: typeof p.note === 'string' ? p.note : undefined,
  };
}

function parsePipeLine(raw: unknown): ParsedHydraulicsPipeLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const catalogPipeId = str(p.catalogPipeId);
  if (!catalogPipeId) return null;
  return {
    catalogPipeId,
    brand: str(p.brand),
    model: str(p.model) || catalogPipeId,
    material: str(p.material),
    outerDiameterMm: num(p.outerDiameterMm),
    wallThicknessMm: num(p.wallThicknessMm),
    internalDiameterMm: num(p.internalDiameterMm),
    totalLengthM: num(p.totalLengthM),
    edgeCount: Math.max(1, Math.round(num(p.edgeCount, 1))),
    pricePerMeter: num(p.pricePerMeter),
    linePrice: num(p.linePrice),
  };
}

function parsePipeSegment(raw: unknown): ParsedHydraulicsPipeSegment | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  const edgeId = str(p.edgeId);
  if (!edgeId) return null;
  const role = p.segmentRole;
  const segmentRole =
    role === 'main' || role === 'branch' || role === 'ufh_loop' || role === 'dhw'
      ? role
      : 'main';
  return {
    edgeId,
    segmentLabel: str(p.segmentLabel) || edgeId,
    segmentRole,
    lengthM: num(p.lengthM),
    catalogPipeId: str(p.catalogPipeId),
    brand: str(p.brand),
    model: str(p.model) || str(p.catalogPipeId),
    material: str(p.material),
    outerDiameterMm: num(p.outerDiameterMm),
    wallThicknessMm: num(p.wallThicknessMm),
    internalDiameterMm: num(p.internalDiameterMm),
    velocityMps: num(p.velocityMps),
    pressureDropKPa: num(p.pressureDropKPa),
    pricePerMeter: num(p.pricePerMeter),
    linePrice: num(p.linePrice),
    ...(p.velocityLimitExceeded === true ? { velocityLimitExceeded: true } : {}),
  };
}

/**
 * Агрегирует участки в сводные позиции каталога.
 */
function aggregatePipeLinesFromSegments(
  segments: ParsedHydraulicsPipeSegment[],
): ParsedHydraulicsPipeLine[] {
  const map = new Map<string, ParsedHydraulicsPipeLine>();

  for (const seg of segments) {
    const prev = map.get(seg.catalogPipeId);
    if (prev) {
      prev.totalLengthM = Math.round((prev.totalLengthM + seg.lengthM) * 100) / 100;
      prev.edgeCount += 1;
      prev.linePrice = Math.round((prev.linePrice + seg.linePrice) * 100) / 100;
    } else {
      map.set(seg.catalogPipeId, {
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

  return [...map.values()].sort((a, b) => b.totalLengthM - a.totalLengthM);
}

function buildPipeLineGroupsFromSegments(
  segments: ParsedHydraulicsPipeSegment[],
): ParsedHydraulicsPipeLineGroup[] {
  const defs: Array<{
    circuitId: ParsedHydraulicsPipeLineGroup['circuitId'];
    label: string;
    roles: ParsedHydraulicsPipeSegment['segmentRole'][];
  }> = [
    {
      circuitId: 'heating',
      label: 'Контур отопления (радиаторы)',
      roles: ['main', 'branch'],
    },
    {
      circuitId: 'ufh',
      label: 'Контур тёплого пола',
      roles: ['ufh_loop'],
    },
  ];

  return defs
    .map((def) => {
      const filtered = segments.filter((s) => def.roles.includes(s.segmentRole));
      const pipeLines = aggregatePipeLinesFromSegments(filtered);
      if (pipeLines.length === 0) return null;
      return {
        circuitId: def.circuitId,
        label: def.label,
        pipeLines,
        estimatedPrice: Math.round(pipeLines.reduce((s, l) => s + l.linePrice, 0) * 100) / 100,
      };
    })
    .filter((g): g is ParsedHydraulicsPipeLineGroup => g != null);
}

function parsePipeLineGroup(raw: unknown): ParsedHydraulicsPipeLineGroup | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  const circuitId = g.circuitId;
  if (circuitId !== 'heating' && circuitId !== 'ufh') return null;
  const pipeLines = (Array.isArray(g.pipeLines) ? g.pipeLines : [])
    .map(parsePipeLine)
    .filter((x): x is ParsedHydraulicsPipeLine => x != null);
  if (pipeLines.length === 0) return null;
  return {
    circuitId,
    label: str(g.label) || (circuitId === 'ufh' ? 'Контур тёплого пола' : 'Контур отопления (радиаторы)'),
    pipeLines,
    estimatedPrice: num(g.estimatedPrice),
  };
}

/**
 * @param matchingHydraulics report.matching.hydraulics
 */
export function parseHydraulicsProposalFromReport(
  matchingHydraulics: Record<string, unknown> | null | undefined,
): ParsedHydraulicsProposal | null {
  if (!matchingHydraulics || typeof matchingHydraulics !== 'object') return null;

  const proposalRaw = matchingHydraulics.proposal;
  const warningsRaw = matchingHydraulics.warnings;
  const warnings = Array.isArray(warningsRaw)
    ? warningsRaw.filter((w): w is string => typeof w === 'string')
    : [];

  if (!proposalRaw || typeof proposalRaw !== 'object') {
    return {
      designFlowM3PerHour: 0,
      headRequiredM: 0,
      pipeLines: [],
      pipeLineGroups: [],
      pipeSegments: [],
      pump: null,
      pumps: [],
      estimatedPipesPrice: 0,
      estimatedPumpPrice: 0,
      estimatedTotalPrice: 0,
      unavailableReason: 'Предложение по гидравлике не сформировано.',
      pumpUnavailableReason: null,
      warnings,
      hasCatalogSelection: false,
      hasPipeSelection: false,
    };
  }

  const proposal = proposalRaw as Record<string, unknown>;
  const pipeLines = (Array.isArray(proposal.pipeLines) ? proposal.pipeLines : [])
    .map(parsePipeLine)
    .filter((x): x is ParsedHydraulicsPipeLine => x != null);
  const pipeSegments = (Array.isArray(proposal.pipeSegments) ? proposal.pipeSegments : [])
    .map(parsePipeSegment)
    .filter((x): x is ParsedHydraulicsPipeSegment => x != null);

  const pipeLineGroupsFromApi = (Array.isArray(proposal.pipeLineGroups) ? proposal.pipeLineGroups : [])
    .map(parsePipeLineGroup)
    .filter((x): x is ParsedHydraulicsPipeLineGroup => x != null);
  const pipeLineGroups =
    pipeLineGroupsFromApi.length > 0
      ? pipeLineGroupsFromApi
      : buildPipeLineGroupsFromSegments(pipeSegments);

  const pumpsRaw = Array.isArray(proposal.pumps) ? proposal.pumps : [];
  const pumpsFromArray = pumpsRaw
    .map(parsePump)
    .filter((x): x is ParsedHydraulicsPumpProposal => x != null);
  const pump = parsePump(proposal.pump) ?? pumpsFromArray[0] ?? null;
  const pumps = pumpsFromArray.length > 0 ? pumpsFromArray : pump ? [pump] : [];

  const unavailableReason =
    typeof proposal.unavailableReason === 'string' ? proposal.unavailableReason : null;
  const pumpUnavailableReason =
    typeof proposal.pumpUnavailableReason === 'string' ? proposal.pumpUnavailableReason : null;

  const hasPipeSelection = pipeLines.length > 0 || pipeLineGroups.length > 0;

  return {
    designFlowM3PerHour: num(proposal.designFlowM3PerHour),
    headRequiredM: num(proposal.headRequiredM),
    topology: parseTopology(proposal.topology),
    pipeLines,
    pipeLineGroups,
    pipeSegments,
    pump,
    pumps,
    estimatedPipesPrice: num(proposal.estimatedPipesPrice),
    estimatedPumpPrice: num(proposal.estimatedPumpPrice),
    estimatedTotalPrice: num(proposal.estimatedTotalPrice),
    unavailableReason,
    pumpUnavailableReason,
    warnings,
    hasCatalogSelection: hasPipeSelection || pumps.length > 0,
    hasPipeSelection,
  };
}
