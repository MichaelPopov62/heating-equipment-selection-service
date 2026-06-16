/**
 * Назначение: Парсинг подбора радиаторов.
 * Описание: Извлечение matching.radiators, lineEconomy и lineEfficient из отчёта.
 */

import {
  isRecord,
  readRecordField,
  readStringArray,
} from './jsonGuards';

/** Рядок підбору радіатора по приміщенню з report.matching.radiators.byRoom. */

export type RadiatorsByRoomRow = {
  roomId: string;
  roomName: string;
  sections: number | null;
};

export type RadiatorsProposalLineView = {
  tier: 'economy' | 'efficient';
  byRoom: RadiatorsByRoomRow[];
  totalSections: number | null;
  unavailableReason: string | null;
  supplyC: number | null;
  returnC: number | null;
};

export type ParsedRadiatorsMatching = {
  chosenModel: string | null;
  byRoom: RadiatorsByRoomRow[];
  /** Сума секцій по приміщеннях (null — немає даних або жоден рядок без числа). */
  totalSections: number | null;
  warnings: string[];
  lineEconomy: RadiatorsProposalLineView | null;
  lineEfficient: RadiatorsProposalLineView | null;
};

function parseByRoomRows(byRoomRaw: unknown): RadiatorsByRoomRow[] {
  const byRoom: RadiatorsByRoomRow[] = [];
  if (!Array.isArray(byRoomRaw)) return byRoom;
  for (const item of byRoomRaw) {
    if (!isRecord(item)) continue;
    const roomId = typeof item.roomId === 'string' ? item.roomId : '';
    const roomNameRaw = item.roomName;
    const roomName =
      typeof roomNameRaw === 'string' && roomNameRaw.trim() !== ''
        ? roomNameRaw
        : roomId || '—';
    const sections =
      typeof item.sections === 'number' && Number.isFinite(item.sections)
        ? Math.trunc(item.sections)
        : null;
    byRoom.push({ roomId, roomName, sections });
  }
  return byRoom;
}

/** Сума секцій по приміщеннях (дзеркало backend totalSectionsFromByRoom). */
function totalFromByRoom(byRoom: RadiatorsByRoomRow[]): number | null {
  const numericSections = byRoom
    .map((r) => r.sections)
    .filter((s): s is number => s != null);
  return numericSections.length > 0
    ? numericSections.reduce((a, b) => a + b, 0)
    : null;
}

function parseProposalLine(
  raw: unknown,
  tier: 'economy' | 'efficient',
): RadiatorsProposalLineView | null {
  if (!isRecord(raw)) return null;
  const tierRaw = raw.tier;
  if (tierRaw !== tier) return null;
  const byRoom = parseByRoomRows(raw.byRoom);
  const inputs = isRecord(raw.inputs) ? raw.inputs : null;
  const supplyC =
    inputs && typeof inputs.supplyC === 'number' ? inputs.supplyC : null;
  const returnC =
    inputs && typeof inputs.returnC === 'number' ? inputs.returnC : null;
  const totalSectionsRaw = raw.totalSections;
  const totalSections =
    typeof totalSectionsRaw === 'number' && Number.isFinite(totalSectionsRaw)
      ? Math.trunc(totalSectionsRaw)
      : totalFromByRoom(byRoom);
  const unavailableReason =
    typeof raw.unavailableReason === 'string' ? raw.unavailableReason : null;
  return {
    tier,
    byRoom,
    totalSections,
    unavailableReason,
    supplyC,
    returnC,
  };
}

/**
 * Витягує підбір радіаторів з повного JSON звіту POST /api/v1/calc.
 */
export function parseRadiatorsMatchingFromReport(
  calcReport: unknown,
): ParsedRadiatorsMatching | null {
  if (!isRecord(calcReport)) return null;
  const matching = readRecordField(calcReport, 'matching');
  if (!matching) return null;
  const radiators = readRecordField(matching, 'radiators');
  if (!radiators) return null;

  const chosenRaw = radiators.chosen;
  let chosenModel: string | null = null;
  if (isRecord(chosenRaw)) {
    const m = chosenRaw.model;
    chosenModel = typeof m === 'string' ? m : null;
  }

  const byRoom = parseByRoomRows(radiators.byRoom);
  const totalSections = totalFromByRoom(byRoom);
  const warnings = readStringArray(radiators.warnings);

  return {
    chosenModel,
    byRoom,
    totalSections,
    warnings,
    lineEconomy: parseProposalLine(radiators.lineEconomy, 'economy'),
    lineEfficient: parseProposalLine(radiators.lineEfficient, 'efficient'),
  };
}
