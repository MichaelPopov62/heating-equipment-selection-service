/**
 * Назначение: парсинг matching.hydraulics.proposal из отчёта calc API.
 */

import type {
  ParsedHydraulicsPipeLine,
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
      pipeSegments: [],
      pump: null,
      pumps: [],
      estimatedPipesPrice: 0,
      estimatedPumpPrice: 0,
      estimatedTotalPrice: 0,
      unavailableReason: 'Предложение по гидравлике не сформировано.',
      warnings,
      hasCatalogSelection: false,
    };
  }

  const proposal = proposalRaw as Record<string, unknown>;
  const pipeLines = (Array.isArray(proposal.pipeLines) ? proposal.pipeLines : [])
    .map(parsePipeLine)
    .filter((x): x is ParsedHydraulicsPipeLine => x != null);
  const pipeSegments = (Array.isArray(proposal.pipeSegments) ? proposal.pipeSegments : [])
    .map(parsePipeSegment)
    .filter((x): x is ParsedHydraulicsPipeSegment => x != null);

  const pumpsRaw = Array.isArray(proposal.pumps) ? proposal.pumps : [];
  const pumpsFromArray = pumpsRaw
    .map(parsePump)
    .filter((x): x is ParsedHydraulicsPumpProposal => x != null);
  const pump = parsePump(proposal.pump) ?? pumpsFromArray[0] ?? null;
  const pumps = pumpsFromArray.length > 0 ? pumpsFromArray : pump ? [pump] : [];

  const unavailableReason =
    typeof proposal.unavailableReason === 'string' ? proposal.unavailableReason : null;

  return {
    designFlowM3PerHour: num(proposal.designFlowM3PerHour),
    headRequiredM: num(proposal.headRequiredM),
    topology: parseTopology(proposal.topology),
    pipeLines,
    pipeSegments,
    pump,
    pumps,
    estimatedPipesPrice: num(proposal.estimatedPipesPrice),
    estimatedPumpPrice: num(proposal.estimatedPumpPrice),
    estimatedTotalPrice: num(proposal.estimatedTotalPrice),
    unavailableReason,
    warnings,
    hasCatalogSelection: pipeLines.length > 0 || pumps.length > 0,
  };
}
