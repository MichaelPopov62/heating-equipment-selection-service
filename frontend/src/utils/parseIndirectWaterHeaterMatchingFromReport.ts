/**
 * Назначение: Парсинг БКН из отчёта.
 * Описание: Разбор matching.indirectWaterHeater для карточки бойлера косвенного нагрева.
 */

import {
  isRecord,
  readRecordField,
  readStringArray,
} from './jsonGuards';

/** Данные подбора БКН из report.matching.indirectWaterHeater */

export type ParsedIndirectWaterHeaterMatching = {
  selectedModel: string | null;
  volumeLiters: number | null;
  coilPowerKw: number | null;
  brand: string | null;
  price: number | null;
  requiredTankLiters: number;
  heatTimeMinutesFullTank: number | null;
  effectiveHeatPowerKw: number | null;
  warnings: string[];
  skippedReason: string | null;
  /** Выбрана позиция из каталога (selected не null). */
  hasCatalogSelection: boolean;
};

/**
 * Извлекает подбор бойлера косвенного нагрева из полного JSON отчёта POST /api/v1/calc.
 */
export function parseIndirectWaterHeaterMatchingFromReport(
  calcReport: unknown,
): ParsedIndirectWaterHeaterMatching | null {
  if (!isRecord(calcReport)) return null;
  const matching = readRecordField(calcReport, 'matching');
  if (!matching) return null;
  const raw = matching.indirectWaterHeater;
  if (!isRecord(raw)) return null;

  const selectedRaw = raw.selected;
  let selectedModel: string | null = null;
  let volumeLiters: number | null = null;
  let coilPowerKwParsed: number | null =
    typeof raw.coilPowerKw === 'number' && Number.isFinite(raw.coilPowerKw)
      ? raw.coilPowerKw
      : null;
  let brand: string | null = null;
  let price: number | null = null;

  const hasCatalogSelection = isRecord(selectedRaw);

  if (hasCatalogSelection) {
    const s = selectedRaw;
    selectedModel = typeof s.model === 'string' ? s.model : null;
    brand = typeof s.brand === 'string' ? s.brand : null;
    price =
      typeof s.price === 'number' && Number.isFinite(s.price) ? s.price : null;
    const specs = s.specs;
    if (isRecord(specs)) {
      const vol = specs.volumeLiters;
      volumeLiters =
        typeof vol === 'number' && Number.isFinite(vol) ? vol : null;
      const pk = specs.powerKw;
      if (
        typeof pk === 'number' &&
        Number.isFinite(pk) &&
        coilPowerKwParsed == null
      ) {
        coilPowerKwParsed = pk;
      }
    }
  }

  const requiredTankLiters =
    typeof raw.requiredTankLiters === 'number' &&
    Number.isFinite(raw.requiredTankLiters)
      ? raw.requiredTankLiters
      : 0;

  const heatTimeMinutesFullTank =
    typeof raw.heatTimeMinutesFullTank === 'number' &&
    Number.isFinite(raw.heatTimeMinutesFullTank)
      ? raw.heatTimeMinutesFullTank
      : null;

  const effectiveHeatPowerKw =
    typeof raw.effectiveHeatPowerKw === 'number' &&
    Number.isFinite(raw.effectiveHeatPowerKw)
      ? raw.effectiveHeatPowerKw
      : null;

  const warnings = readStringArray(raw.warnings);

  const skippedReason =
    typeof raw.skippedReason === 'string' && raw.skippedReason.trim() !== ''
      ? raw.skippedReason
      : null;

  return {
    selectedModel,
    volumeLiters,
    coilPowerKw: coilPowerKwParsed,
    brand,
    price,
    requiredTankLiters,
    heatTimeMinutesFullTank,
    effectiveHeatPowerKw,
    warnings,
    skippedReason,
    hasCatalogSelection,
  };
}
