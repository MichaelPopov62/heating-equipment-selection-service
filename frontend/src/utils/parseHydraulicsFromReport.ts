/**
 * Назначение: парсинг гидравлики из полного отчёта calc API.
 * Описание: matching.hydraulics.proposal, calculations.hydraulics и контекст flowDeltaTK.
 */

import type {
  ParsedHydraulicsCalculations,
  ParsedHydraulicsFlowContext,
  ParsedHydraulicsView,
} from '../types/hydraulics';
import { isRecord, readRecordField, readStringArray } from './jsonGuards';
import { parseHydraulicsProposalFromReport } from './parseHydraulicsProposalFromReport';

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseCalculations(raw: unknown): ParsedHydraulicsCalculations | null {
  if (!isRecord(raw)) return null;
  const flowRateM3PerHour = num(raw.flowRateM3PerHour);
  const pressure = isRecord(raw.pressure) ? raw.pressure : null;
  const headFromPressure =
    pressure && typeof pressure.headRequiredM === 'number'
      ? pressure.headRequiredM
      : null;
  const headRequiredM = headFromPressure ?? 0;
  if (flowRateM3PerHour == null && headRequiredM <= 0) return null;

  const inputs = isRecord(raw.inputs) ? raw.inputs : null;
  const notes = Array.isArray(raw.notes)
    ? raw.notes.filter((n): n is string => typeof n === 'string')
    : [];

  return {
    flowRateM3PerHour: flowRateM3PerHour ?? 0,
    headRequiredM,
    deltaTSystemK: inputs ? num(inputs.deltaTSystemK) : null,
    mainLineLengthM: inputs ? num(inputs.mainLineLengthM) : null,
    recommendedPipeDiameter:
      typeof raw.recommendedPipeDiameter === 'string' && raw.recommendedPipeDiameter
        ? raw.recommendedPipeDiameter
        : null,
    notes,
  };
}

function parseFlowContextFromRadiators(radiators: Record<string, unknown>): ParsedHydraulicsFlowContext | null {
  const inputs = isRecord(radiators.inputs) ? radiators.inputs : null;
  if (!inputs) return null;

  const supplyC = num(inputs.supplyC);
  const returnC = num(inputs.returnC);
  const flowDeltaTK = num(inputs.flowDeltaTK);
  const thermalRegimeDeltaTK =
    supplyC != null && returnC != null
      ? Math.round((supplyC - returnC) * 100) / 100
      : null;

  if (flowDeltaTK == null && thermalRegimeDeltaTK == null && supplyC == null) {
    return null;
  }

  return {
    supplyC,
    returnC,
    thermalRegimeDeltaTK,
    flowDeltaTK,
  };
}

/**
 * @param calcReport Полный JSON report POST /api/v1/calc
 */
export function parseHydraulicsFromReport(calcReport: unknown): ParsedHydraulicsView | null {
  if (!isRecord(calcReport)) return null;

  const calculationsBlock = readRecordField(calcReport, 'calculations');
  const calculationsRaw = calculationsBlock
    ? readRecordField(calculationsBlock, 'hydraulics')
    : null;
  const calculations = parseCalculations(calculationsRaw);

  const matching = readRecordField(calcReport, 'matching');
  const matchingHydraulics = matching ? readRecordField(matching, 'hydraulics') : null;
  const matchingWarnings = matchingHydraulics
    ? readStringArray(matchingHydraulics.warnings)
    : [];

  const proposal = parseHydraulicsProposalFromReport(
    matchingHydraulics as Record<string, unknown> | null | undefined,
  );

  let flowContext: ParsedHydraulicsFlowContext | null = null;
  if (matching) {
    const radiators = readRecordField(matching, 'radiators');
    if (radiators) {
      flowContext = parseFlowContextFromRadiators(radiators);
    }
  }

  const hasProposalData =
    proposal != null
    && (proposal.hasPipeSelection
      || proposal.pumps.length > 0
      || proposal.designFlowM3PerHour > 0
      || proposal.headRequiredM > 0
      || proposal.unavailableReason != null);

  const hasData =
    calculations != null
    || hasProposalData
    || matchingWarnings.length > 0
    || (proposal != null && proposal.warnings.length > 0);

  if (!hasData) return null;

  return {
    proposal: hasProposalData ? proposal : null,
    calculations,
    flowContext,
    matchingWarnings,
    hasData: true,
  };
}
