/**
 * Назначение: Парсинг report.matching.uniboxes для UI сметы.
 * Описание: Строки byLoop с selected / warnings и параметрами demand.
 */

import { isRecord, readRecordField } from './jsonGuards';

export type ParsedUniboxConnection = {
  thread: string;
  fit: string;
};

export type ParsedUniboxSelected = {
  id: string;
  brand: string;
  model: string;
  type: string;
  price: number;
  maxAreaSqM: number;
  maxLoopLengthM: number;
  kvM3h: number;
  connection: ParsedUniboxConnection;
};

export type ParsedUniboxLoopDemand = {
  areaSqM: number;
  loopLengthM: number;
  circuitSupplyC: number;
  circuitReturnC: number;
  flowLph: number;
  roomAirTempC: number;
  systemPressureBar: number;
  minKvM3h: number;
  requiredFit: string;
};

export type ParsedUniboxLoopRow = {
  roomId: string;
  loopId: string;
  required: ParsedUniboxLoopDemand;
  selected: ParsedUniboxSelected | null;
  warnings: string[];
};

export type ParsedUniboxesMatching = {
  byLoop: ParsedUniboxLoopRow[];
  warnings: string[];
};

/**
 * @param {unknown} raw
 * @returns {ParsedUniboxSelected | null}
 */
function parseSelected(raw: unknown): ParsedUniboxSelected | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const brand = typeof raw.brand === 'string' ? raw.brand.trim() : '';
  const model = typeof raw.model === 'string' ? raw.model.trim() : '';
  const type = typeof raw.type === 'string' ? raw.type.trim() : '';
  const price = Number(raw.price);
  const maxAreaSqM = Number(raw.maxAreaSqM);
  const maxLoopLengthM = Number(raw.maxLoopLengthM);
  const kvM3h = Number(raw.kvM3h);
  if (!id || !brand || !model || !type || !Number.isFinite(price)) return null;
  const conn = isRecord(raw.connection) ? raw.connection : null;
  const thread = conn && typeof conn.thread === 'string' ? conn.thread : '';
  const fit = conn && typeof conn.fit === 'string' ? conn.fit : '';
  if (!thread || !fit) return null;
  return {
    id,
    brand,
    model,
    type,
    price,
    maxAreaSqM: Number.isFinite(maxAreaSqM) ? maxAreaSqM : 0,
    maxLoopLengthM: Number.isFinite(maxLoopLengthM) ? maxLoopLengthM : 0,
    kvM3h: Number.isFinite(kvM3h) ? kvM3h : 0,
    connection: { thread, fit },
  };
}

/**
 * @param {unknown} raw
 * @returns {ParsedUniboxLoopDemand | null}
 */
function parseDemand(raw: unknown): ParsedUniboxLoopDemand | null {
  if (!isRecord(raw)) return null;
  const areaSqM = Number(raw.areaSqM);
  const loopLengthM = Number(raw.loopLengthM);
  const circuitSupplyC = Number(raw.circuitSupplyC);
  const circuitReturnC = Number(raw.circuitReturnC);
  const flowLph = Number(raw.flowLph);
  const roomAirTempC = Number(raw.roomAirTempC);
  const systemPressureBar = Number(raw.systemPressureBar);
  const minKvM3h = Number(raw.minKvM3h);
  const requiredFit = typeof raw.requiredFit === 'string' ? raw.requiredFit : '';
  if (
    ![areaSqM, loopLengthM, circuitSupplyC, circuitReturnC, flowLph, roomAirTempC, systemPressureBar, minKvM3h].every(
      (n) => Number.isFinite(n),
    )
    || !requiredFit
  ) {
    return null;
  }
  return {
    areaSqM,
    loopLengthM,
    circuitSupplyC,
    circuitReturnC,
    flowLph,
    roomAirTempC,
    systemPressureBar,
    minKvM3h,
    requiredFit,
  };
}

/**
 * @param {unknown} calcReport
 * @returns {ParsedUniboxesMatching | null}
 */
export function parseUniboxesMatchingFromReport(calcReport: unknown): ParsedUniboxesMatching | null {
  if (!isRecord(calcReport)) return null;
  const matching = readRecordField(calcReport, 'matching');
  if (!matching) return null;
  const block = readRecordField(matching, 'uniboxes');
  if (!block) return null;

  const warningsRaw = Array.isArray(block.warnings) ? block.warnings : [];
  const warnings = warningsRaw.filter((w): w is string => typeof w === 'string' && w.trim().length > 0);

  const byLoopRaw = Array.isArray(block.byLoop) ? block.byLoop : [];
  /** @type {ParsedUniboxLoopRow[]} */
  const byLoop: ParsedUniboxLoopRow[] = [];
  for (const row of byLoopRaw) {
    if (!isRecord(row)) continue;
    const roomId = typeof row.roomId === 'string' ? row.roomId : '';
    const loopId = typeof row.loopId === 'string' ? row.loopId : '';
    const required = parseDemand(row.required);
    if (!roomId || !loopId || !required) continue;
    const rowWarnings = Array.isArray(row.warnings)
      ? row.warnings.filter((w): w is string => typeof w === 'string' && w.trim().length > 0)
      : [];
    byLoop.push({
      roomId,
      loopId,
      required,
      selected: parseSelected(row.selected),
      warnings: rowWarnings,
    });
  }

  if (byLoop.length === 0 && warnings.length === 0) return null;
  return { byLoop, warnings };
}
