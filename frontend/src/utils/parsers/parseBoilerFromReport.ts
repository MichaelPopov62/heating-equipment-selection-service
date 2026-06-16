/**
 * Назначение: Парсинг блока котла из отчёта.
 * Описание: Разбор matching.boiler, selected и tier economy/efficient для UI.
 */

import { parseBoilerProposalPayload } from '../boilerProposalParse';
import { readRecordField, readStringArray } from '../jsonGuards';
import {
  SCHEME_BOILER_MAX_COMBI,
  type HotWaterBoilerPowerMatchingScheme,
} from '../../types/heatingMatching';

/** Проверка, является ли строка допустимой схемой котла (импортируется из App.tsx). */
type IsCalcMatchingScheme = (v: string) => v is HotWaterBoilerPowerMatchingScheme;

export type ParsedBoilerSummary = {
  heatLossKw: number;
  reserveFactor: number;
  heatingLoadKw: number;
  hotWaterPowerKw: number;
  requiredKw: number;
  hotWaterBoilerPowerMatchingScheme: HotWaterBoilerPowerMatchingScheme;
  heatingLoadKwCondensing: number | null;
  requiredKwForCondensingLine: number | null;
  condensingHeatingReserveFactor: number | null;
};

export type ParsedBoilerMatching = {
  summary: ParsedBoilerSummary | null;
  tierEconomy: ReturnType<typeof parseBoilerProposalPayload>;
  tierEfficient: ReturnType<typeof parseBoilerProposalPayload>;
  legacyProposal: ReturnType<typeof parseBoilerProposalPayload>;
  warnings: string[];
};

/**
 * Витягує блок matching.boiler з повного JSON-звіту POST /api/v1/calc.
 * Повертає null, якщо блок відсутній.
 */
export function parseBoilerFromReport(
  calcReport: unknown,
  isCalcMatchingScheme: IsCalcMatchingScheme,
): ParsedBoilerMatching | null {
  if (calcReport === null || calcReport === undefined) return null;
  const matching = readRecordField(calcReport as Record<string, unknown>, 'matching');
  if (!matching) return null;
  const b = readRecordField(matching, 'boiler');
  if (!b) return null;

  const heatLossKw =
    typeof b.heatLossKw === 'number' && Number.isFinite(b.heatLossKw) ? b.heatLossKw : null;
  const reserveFactor =
    typeof b.reserveFactor === 'number' && Number.isFinite(b.reserveFactor) ? b.reserveFactor : null;
  const hotWaterPowerKw =
    typeof b.hotWaterPowerKw === 'number' && Number.isFinite(b.hotWaterPowerKw)
      ? b.hotWaterPowerKw
      : null;
  const requiredKw =
    typeof b.requiredKw === 'number' && Number.isFinite(b.requiredKw) ? b.requiredKw : null;
  const heatingLoadKw =
    typeof b.heatingLoadKw === 'number' && Number.isFinite(b.heatingLoadKw) ? b.heatingLoadKw : null;

  const schemeRaw = b.hotWaterBoilerPowerMatchingScheme;
  const schemeParsed: HotWaterBoilerPowerMatchingScheme | null =
    typeof schemeRaw === 'string' && isCalcMatchingScheme(schemeRaw) ? schemeRaw : null;
  const schemeForSummary: HotWaterBoilerPowerMatchingScheme = schemeParsed ?? SCHEME_BOILER_MAX_COMBI;

  const heatingLoadKwCondensing =
    typeof b.heatingLoadKwCondensing === 'number' && Number.isFinite(b.heatingLoadKwCondensing)
      ? b.heatingLoadKwCondensing
      : null;
  const requiredKwForCondensingLine =
    typeof b.requiredKwForCondensingLine === 'number' && Number.isFinite(b.requiredKwForCondensingLine)
      ? b.requiredKwForCondensingLine
      : null;
  const condensingHeatingReserveFactor =
    typeof b.condensingHeatingReserveFactor === 'number' &&
    Number.isFinite(b.condensingHeatingReserveFactor)
      ? b.condensingHeatingReserveFactor
      : null;

  let summary: ParsedBoilerSummary | null = null;
  if (heatLossKw != null && reserveFactor != null && hotWaterPowerKw != null && requiredKw != null) {
    summary = {
      heatLossKw,
      reserveFactor,
      heatingLoadKw: heatingLoadKw ?? heatLossKw * reserveFactor,
      hotWaterPowerKw,
      requiredKw,
      hotWaterBoilerPowerMatchingScheme: schemeForSummary,
      heatingLoadKwCondensing,
      requiredKwForCondensingLine,
      condensingHeatingReserveFactor,
    };
  }

  return {
    summary,
    tierEconomy: parseBoilerProposalPayload(b.proposalEconomy),
    tierEfficient: parseBoilerProposalPayload(b.proposalEfficient),
    legacyProposal: parseBoilerProposalPayload(b.proposal),
    warnings: readStringArray(b.warnings),
  };
}
