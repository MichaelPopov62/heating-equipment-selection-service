/**
 * Назначение: парсинг report.commercial для шага «Итог финансовый».
 */

import { isRecord, readRecordField } from './jsonGuards';

export type FinancialBomLineKind = 'equipment' | 'labor' | 'consumable' | 'note';
export type FinancialBomQtyUnit = 'pcs' | 'm' | 'section' | 'lot';
export type FinancialBomCategoryId =
  | 'boiler_room'
  | 'radiators'
  | 'ufh'
  | 'hydraulics_heating'
  | 'works';

export type ParsedFinancialBomLine = {
  id: string;
  kind: FinancialBomLineKind;
  objectType: 'house' | 'apartment';
  equipmentTypeLabel: string;
  brand: string;
  model: string;
  qty: number;
  qtyUnit: FinancialBomQtyUnit;
  unitPriceUah: number | null;
  lineTotalUah: number | null;
  scopePath: string[];
  categoryId: FinancialBomCategoryId;
  catalogId?: string;
  source: string;
  note?: string;
};

export type ParsedCommercialBom = {
  schemaVersion: 1;
  currency: 'UAH';
  lines: ParsedFinancialBomLine[];
  totals: {
    equipmentQtyPcs: number;
    equipmentTotalUah: number;
    laborTotalUah: number;
    consumablesTotalUah: number;
    grandTotalUah: number;
  };
  rates: {
    laborPercentOfEquipment: number;
    consumablesPercentOfEquipment: number;
  };
};

const KINDS = new Set<string>(['equipment', 'labor', 'consumable', 'note']);
const QTY_UNITS = new Set<string>(['pcs', 'm', 'section', 'lot']);
const CATEGORIES = new Set<string>([
  'boiler_room',
  'radiators',
  'ufh',
  'hydraulics_heating',
  'works',
]);

/**
 * @param {unknown} v
 * @returns {number}
 */
function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * @param {unknown} v
 * @returns {string}
 */
function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * @param {unknown} raw
 * @returns {ParsedFinancialBomLine | null}
 */
function parseLine(raw: unknown): ParsedFinancialBomLine | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  const kind = str(raw.kind);
  const qtyUnit = str(raw.qtyUnit);
  const categoryId = str(raw.categoryId);
  const model = str(raw.model);
  if (!id || !KINDS.has(kind) || !QTY_UNITS.has(qtyUnit) || !CATEGORIES.has(categoryId)) {
    return null;
  }
  if (!model && kind !== 'note') return null;

  const objectType = raw.objectType === 'apartment' ? 'apartment' : 'house';
  const scopePath = Array.isArray(raw.scopePath)
    ? raw.scopePath.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : [];
  if (scopePath.length === 0) return null;

  const unitPriceRaw = raw.unitPriceUah;
  const lineTotalRaw = raw.lineTotalUah;
  const catalogId = str(raw.catalogId);
  const note = str(raw.note);

  return {
    id,
    kind: kind as FinancialBomLineKind,
    objectType,
    equipmentTypeLabel: str(raw.equipmentTypeLabel) || 'Позиция',
    brand: str(raw.brand),
    model: model || str(raw.note) || '—',
    qty: Math.max(0, num(raw.qty)),
    qtyUnit: qtyUnit as FinancialBomQtyUnit,
    unitPriceUah:
      typeof unitPriceRaw === 'number' && Number.isFinite(unitPriceRaw)
        ? unitPriceRaw
        : null,
    lineTotalUah:
      typeof lineTotalRaw === 'number' && Number.isFinite(lineTotalRaw)
        ? lineTotalRaw
        : null,
    scopePath,
    categoryId: categoryId as FinancialBomCategoryId,
    ...(catalogId ? { catalogId } : {}),
    source: str(raw.source) || 'commercial',
    ...(note ? { note } : {}),
  };
}

/**
 * Извлекает report.commercial из JSON-отчёта calc.
 *
 * @param calcReport
 */
export function parseCommercialBomFromReport(
  calcReport: unknown,
): ParsedCommercialBom | null {
  if (calcReport == null) return null;
  if (!isRecord(calcReport)) return null;
  const commercial = readRecordField(calcReport, 'commercial');
  if (!commercial) return null;

  const linesRaw = commercial.lines;
  if (!Array.isArray(linesRaw)) return null;

  const lines: ParsedFinancialBomLine[] = [];
  for (const item of linesRaw) {
    const parsed = parseLine(item);
    if (parsed) lines.push(parsed);
  }

  const totalsRaw = readRecordField(commercial, 'totals');
  const ratesRaw = readRecordField(commercial, 'rates');
  if (!totalsRaw || !ratesRaw) return null;

  return {
    schemaVersion: 1,
    currency: 'UAH',
    lines,
    totals: {
      equipmentQtyPcs: num(totalsRaw.equipmentQtyPcs),
      equipmentTotalUah: num(totalsRaw.equipmentTotalUah),
      laborTotalUah: num(totalsRaw.laborTotalUah),
      consumablesTotalUah: num(totalsRaw.consumablesTotalUah),
      grandTotalUah: num(totalsRaw.grandTotalUah),
    },
    rates: {
      laborPercentOfEquipment: num(ratesRaw.laborPercentOfEquipment, 40),
      consumablesPercentOfEquipment: num(
        ratesRaw.consumablesPercentOfEquipment,
        15,
      ),
    },
  };
}
