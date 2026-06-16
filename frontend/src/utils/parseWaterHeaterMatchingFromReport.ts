/**
 * Назначение: Парсинг электробойлера из отчёта.
 * Описание: Разбор matching.waterHeater для WaterHeaterProposalCard.
 */

import {
  isRecord,
  readRecordField,
  readStringArray,
} from './jsonGuards';

/** Данные подбора электрического накопительного водонагревателя из report.matching.waterHeater */

export type ParsedWaterHeaterMatching = {
  selectedModel: string | null;
  brand: string | null;
  volumeLiters: number | null;
  price: number | null;
  powerKw: number | null;
  requiredTankLiters: number;
  warnings: string[];
  /** Выбрана позиция из каталога (selected и chosenVariant). */
  hasCatalogSelection: boolean;
};

/**
 * Извлекает подбор электробойлера из полного JSON отчёта POST /api/v1/calc.
 * Возвращает null, если блок отсутствует или это пустая заглушка без подбора.
 */
export function parseWaterHeaterMatchingFromReport(
  calcReport: unknown,
): ParsedWaterHeaterMatching | null {
  if (!isRecord(calcReport)) return null;
  const matching = readRecordField(calcReport, 'matching');
  if (!matching) return null;
  const raw = matching.waterHeater;
  if (!isRecord(raw)) return null;

  const selectedRaw = raw.selected;
  const variantRaw = raw.chosenVariant;
  const hasCatalogSelection =
    isRecord(selectedRaw) && isRecord(variantRaw);

  let selectedModel: string | null = null;
  let brand: string | null = null;
  let volumeLiters: number | null = null;
  let price: number | null = null;
  let powerKw: number | null = null;

  if (hasCatalogSelection) {
    const s = selectedRaw;
    selectedModel = typeof s.model === 'string' ? s.model : null;
    brand = typeof s.brand === 'string' ? s.brand : null;
    const v = variantRaw;
    volumeLiters =
      typeof v.volumeLiters === 'number' && Number.isFinite(v.volumeLiters)
        ? v.volumeLiters
        : null;
    price =
      typeof v.price === 'number' && Number.isFinite(v.price) ? v.price : null;
    powerKw =
      typeof v.powerKw === 'number' && Number.isFinite(v.powerKw)
        ? v.powerKw
        : null;
  }

  const requiredTankLiters =
    typeof raw.requiredTankLiters === 'number' &&
    Number.isFinite(raw.requiredTankLiters)
      ? raw.requiredTankLiters
      : 0;

  const warnings = readStringArray(raw.warnings);

  if (
    !hasCatalogSelection &&
    warnings.length === 0 &&
    requiredTankLiters <= 0
  ) {
    return null;
  }

  return {
    selectedModel,
    brand,
    volumeLiters,
    price,
    powerKw,
    requiredTankLiters,
    warnings,
    hasCatalogSelection,
  };
}
