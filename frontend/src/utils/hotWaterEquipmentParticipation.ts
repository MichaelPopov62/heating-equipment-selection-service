/**
 * Назначение: Подписи строк ЭБ/БКН в компактной таблице ГВС.
 * Описание: Участие по схеме котёл/ГВС и данным matching из отчёта.
 */

import type { HotWaterBoilerPowerMatchingScheme } from '../types/heatingMatching';
import {
  SCHEME_BOILER_COMBI_BUFFER_ELECTRIC,
  SCHEME_BOILER_ELECTRIC_SEPARATE,
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
} from '../types/heatingMatching';
import type { ParsedIndirectWaterHeaterMatching } from './parseIndirectWaterHeaterMatchingFromReport';
import type { ParsedWaterHeaterMatching } from './parseWaterHeaterMatchingFromReport';
import { formatKw, formatLiters } from './format';

export type HotWaterEquipmentKind = 'electric' | 'indirect';

const NOT_PARTICIPATING = 'Не участвует в расчёте';
const PENDING = '— (ожидается расчёт)';

/**
 * @param scheme
 * @param kind
 */
export function isHotWaterEquipmentSchemeParticipant(
  scheme: HotWaterBoilerPowerMatchingScheme,
  kind: HotWaterEquipmentKind,
): boolean {
  if (kind === 'electric') {
    return (
      scheme === SCHEME_BOILER_ELECTRIC_SEPARATE
      || scheme === SCHEME_BOILER_COMBI_BUFFER_ELECTRIC
      || scheme === SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC
    );
  }
  return (
    scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM
    || scheme === SCHEME_BOILER_MAX_COMBI
  );
}

/**
 * @param matching
 */
function formatElectricMatchingLabel(
  matching: ParsedWaterHeaterMatching,
): string {
  const parts: string[] = [];
  if (matching.requiredTankLiters > 0) {
    parts.push(`${formatLiters(matching.requiredTankLiters)} л`);
  }
  if (matching.hasCatalogSelection) {
    if (matching.selectedModel != null) parts.push(matching.selectedModel);
    if (matching.volumeLiters != null) {
      parts.push(`${formatLiters(matching.volumeLiters)} л (каталог)`);
    }
    if (matching.powerKw != null) {
      parts.push(`${formatKw(matching.powerKw)} кВт`);
    }
  }
  if (parts.length === 0 && matching.warnings.length > 0) {
    return matching.warnings[0] ?? 'Подбор без позиции каталога';
  }
  return parts.length > 0 ? parts.join(' · ') : 'Подбор выполнен';
}

/**
 * @param matching
 */
function formatIndirectMatchingLabel(
  matching: ParsedIndirectWaterHeaterMatching,
): string {
  if (matching.skippedReason != null && !matching.hasCatalogSelection) {
    return NOT_PARTICIPATING;
  }
  const parts: string[] = [];
  if (matching.requiredTankLiters > 0) {
    parts.push(`${formatLiters(matching.requiredTankLiters)} л`);
  }
  if (matching.hasCatalogSelection) {
    if (matching.selectedModel != null) parts.push(matching.selectedModel);
    if (matching.volumeLiters != null) {
      parts.push(`${formatLiters(matching.volumeLiters)} л (каталог)`);
    }
    if (matching.effectiveHeatPowerKw != null) {
      parts.push(`${formatKw(matching.effectiveHeatPowerKw)} кВт`);
    }
  }
  if (parts.length === 0 && matching.warnings.length > 0) {
    return matching.warnings[0] ?? 'Подбор без позиции каталога';
  }
  return parts.length > 0 ? parts.join(' · ') : 'Подбор выполнен';
}

/**
 * @param args
 * @param args.kind
 * @param args.scheme
 * @param args.matching
 * @param args.hasReport
 */
export function resolveHotWaterEquipmentRowLabel(args: {
  kind: HotWaterEquipmentKind;
  scheme: HotWaterBoilerPowerMatchingScheme;
  matching: ParsedWaterHeaterMatching | ParsedIndirectWaterHeaterMatching | null;
  hasReport: boolean;
}): string {
  const { kind, scheme, matching, hasReport } = args;

  if (!hasReport) {
    if (!isHotWaterEquipmentSchemeParticipant(scheme, kind)) {
      return NOT_PARTICIPATING;
    }
    return PENDING;
  }

  if (kind === 'electric') {
    const electric = matching as ParsedWaterHeaterMatching | null;
    const schemeUsesElectric = isHotWaterEquipmentSchemeParticipant(
      scheme,
      'electric',
    );
    // Поза схемами з ЕВН показуємо ЕБ лише при реальному fallback (модель або warnings).
    // «Голі» requiredTankLiters без підбору — не участь (баг дзеркала літрів при 1К+БКН).
    const hasRealElectricMatch =
      electric != null
      && (electric.hasCatalogSelection || electric.warnings.length > 0);
    if (!schemeUsesElectric && !hasRealElectricMatch) {
      return NOT_PARTICIPATING;
    }
    if (electric == null) {
      return schemeUsesElectric ? PENDING : NOT_PARTICIPATING;
    }
    return formatElectricMatchingLabel(electric);
  }

  const indirect = matching as ParsedIndirectWaterHeaterMatching | null;
  if (
    !isHotWaterEquipmentSchemeParticipant(scheme, 'indirect')
    && (indirect == null || indirect.skippedReason != null)
  ) {
    return NOT_PARTICIPATING;
  }
  if (indirect == null) {
    return isHotWaterEquipmentSchemeParticipant(scheme, 'indirect')
      ? PENDING
      : NOT_PARTICIPATING;
  }
  return formatIndirectMatchingLabel(indirect);
}

/**
 * @param electric
 * @param indirect
 */
export function hasHotWaterEquipmentWarnings(
  electric: ParsedWaterHeaterMatching | null,
  indirect: ParsedIndirectWaterHeaterMatching | null,
): boolean {
  return (electric?.warnings.length ?? 0) > 0
    || (indirect?.warnings.length ?? 0) > 0;
}
