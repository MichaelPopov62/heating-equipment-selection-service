/**
 * Назначение: Парсинг подбора радиаторов.
 * Описание: Извлечение matching.radiators, lineEconomy/lineEfficient, emittersSummary.
 */

import {
  isRecord,
  readRecordField,
  readStringArray,
} from './jsonGuards';

export type RadiatorDisplayKind = 'sectional' | 'panel' | 'none';

export type RadiatorsEmittersSummaryView = {
  panelUnits: number;
  sectionalUnits: number;
  sectionalSections: number;
  totalDeliverableWatts: number;
  roomsWithEmitter: number;
  roomsSkipped: number;
};

/** Рядок підбору радіатора по приміщенню. */
export type RadiatorsByRoomRow = {
  roomId: string;
  roomName: string;
  sections: number | null;
  priceBasis: 'section' | 'panel' | null;
  panelLengthMm: number | null;
  radiatorModel: string | null;
  deliverableWatts: number | null;
  displayKind: RadiatorDisplayKind;
  unitsCount: number | null;
  /** true — тип приладу відрізняється від economy (лише для efficient-таблиці). */
  equipmentKindChangedVsEconomy: boolean;
};

export type RadiatorsProposalLineView = {
  tier: 'economy' | 'efficient';
  byRoom: RadiatorsByRoomRow[];
  totalSections: number | null;
  emittersSummary: RadiatorsEmittersSummaryView | null;
  unavailableReason: string | null;
  supplyC: number | null;
  returnC: number | null;
};

export type ParsedRadiatorsMatching = {
  chosenModel: string | null;
  byRoom: RadiatorsByRoomRow[];
  /** Сума секцій (без панелей). */
  totalSections: number | null;
  emittersSummary: RadiatorsEmittersSummaryView | null;
  roomEmitterDiffs: Array<{
    roomId: string;
    equipmentKindChanged: boolean;
  }>;
  warnings: string[];
  lineEconomy: RadiatorsProposalLineView | null;
  lineEfficient: RadiatorsProposalLineView | null;
  inputs: {
    supplyC: number | null;
    returnC: number | null;
    flowDeltaTK: number | null;
    /** EN442 mean ΔT = (Ts+Tr)/2 − Ti з matching.radiators.inputs.targetDeltaT. */
    targetDeltaT: number | null;
    radiatorConnection: 'side' | 'bottom' | null;
    radiatorEmitterPreference: 'auto' | 'sectional' | 'panel' | null;
  } | null;
  resolvedEmitterKind: 'sectional' | 'panel' | null;
};

/**
 * Формат шапки emitters для UI.
 */
export function formatRadiatorsEmittersSummaryLabel(
  summary: RadiatorsEmittersSummaryView | null | undefined,
): string | null {
  if (summary == null) return null;
  const parts: string[] = [];
  if (summary.panelUnits > 0) {
    parts.push(`панельные: ${summary.panelUnits} шт.`);
  }
  if (summary.sectionalUnits > 0) {
    parts.push(
      `секционные: ${summary.sectionalSections} сек. (${summary.sectionalUnits} приб.)`,
    );
  }
  if (summary.totalDeliverableWatts > 0) {
    parts.push(`Σ ≈ ${Math.round(summary.totalDeliverableWatts)} Вт`);
  }
  if (parts.length === 0) {
    return summary.roomsSkipped > 0 ? 'приборы не требуются' : null;
  }
  return parts.join(' · ');
}

/**
 * Підпис кількості в таблиці (секції або панель).
 */
export function formatRadiatorRoomQuantityLabel(row: RadiatorsByRoomRow): string {
  if (row.displayKind === 'none' || !row.radiatorModel || row.radiatorModel === '—') {
    return '—';
  }
  if (row.displayKind === 'panel' || row.priceBasis === 'panel') {
    const len =
      row.panelLengthMm != null && Number.isFinite(row.panelLengthMm)
        ? ` ${Math.round(row.panelLengthMm)} мм`
        : '';
    const n =
      row.unitsCount != null && row.unitsCount > 1 ? row.unitsCount : 1;
    return n > 1
      ? `${n} шт. (панель${len})`
      : `1 шт. (панель${len})`;
  }
  if (row.sections != null) {
    const n =
      row.unitsCount != null && row.unitsCount > 1 ? row.unitsCount : 1;
    return n > 1
      ? `${n}×${row.sections} сек.`
      : `${row.sections} сек.`;
  }
  return '—';
}

function parseEmittersSummary(raw: unknown): RadiatorsEmittersSummaryView | null {
  if (!isRecord(raw)) return null;
  const num = (k: string): number => {
    const v = raw[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  };
  return {
    panelUnits: Math.trunc(num('panelUnits')),
    sectionalUnits: Math.trunc(num('sectionalUnits')),
    sectionalSections: Math.trunc(num('sectionalSections')),
    totalDeliverableWatts: num('totalDeliverableWatts'),
    roomsWithEmitter: Math.trunc(num('roomsWithEmitter')),
    roomsSkipped: Math.trunc(num('roomsSkipped')),
  };
}

function parseDisplayKind(raw: unknown): RadiatorDisplayKind {
  if (raw === 'sectional' || raw === 'panel' || raw === 'none') return raw;
  return 'none';
}

function parseByRoomRows(
  byRoomRaw: unknown,
  kindChangedByRoomId?: ReadonlySet<string>,
): RadiatorsByRoomRow[] {
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
    const priceBasis =
      item.priceBasis === 'section' || item.priceBasis === 'panel'
        ? item.priceBasis
        : null;
    const panelLengthMm =
      typeof item.panelLengthMm === 'number' && Number.isFinite(item.panelLengthMm)
        ? item.panelLengthMm
        : null;
    const radiatorModel =
      typeof item.radiatorModel === 'string' ? item.radiatorModel : null;
    const deliverableWatts =
      typeof item.deliverableWatts === 'number' && Number.isFinite(item.deliverableWatts)
        ? item.deliverableWatts
        : null;
    const unitsCount =
      typeof item.unitsCount === 'number' && Number.isFinite(item.unitsCount)
        ? Math.trunc(item.unitsCount)
        : null;
    let displayKind = parseDisplayKind(item.displayKind);
    if (displayKind === 'none') {
      if (priceBasis === 'panel') displayKind = 'panel';
      else if (priceBasis === 'section' || sections != null) displayKind = 'sectional';
      else if (radiatorModel && radiatorModel !== '—') displayKind = 'sectional';
    }
    byRoom.push({
      roomId,
      roomName,
      sections,
      priceBasis,
      panelLengthMm,
      radiatorModel,
      deliverableWatts,
      displayKind,
      unitsCount,
      equipmentKindChangedVsEconomy: Boolean(
        roomId && kindChangedByRoomId?.has(roomId),
      ),
    });
  }
  return byRoom;
}

function parseProposalLine(
  raw: unknown,
  tier: 'economy' | 'efficient',
  kindChangedByRoomId?: ReadonlySet<string>,
): RadiatorsProposalLineView | null {
  if (!isRecord(raw)) return null;
  const tierRaw = raw.tier;
  if (tierRaw !== tier) return null;
  const byRoom = parseByRoomRows(
    raw.byRoom,
    tier === 'efficient' ? kindChangedByRoomId : undefined,
  );
  const inputs = isRecord(raw.inputs) ? raw.inputs : null;
  const supplyC =
    inputs && typeof inputs.supplyC === 'number' ? inputs.supplyC : null;
  const returnC =
    inputs && typeof inputs.returnC === 'number' ? inputs.returnC : null;
  const emittersSummary = parseEmittersSummary(raw.emittersSummary);
  const totalSectionsRaw = raw.totalSections;
  const totalSections =
    typeof totalSectionsRaw === 'number' && Number.isFinite(totalSectionsRaw)
      ? Math.trunc(totalSectionsRaw)
      : emittersSummary != null
        ? emittersSummary.sectionalSections
        : null;
  const unavailableReason =
    typeof raw.unavailableReason === 'string' ? raw.unavailableReason : null;
  return {
    tier,
    byRoom,
    totalSections,
    emittersSummary,
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

  const kindChangedByRoomId = new Set<string>();
  const diffsRaw = radiators.roomEmitterDiffs;
  if (Array.isArray(diffsRaw)) {
    for (const d of diffsRaw) {
      if (!isRecord(d)) continue;
      if (d.equipmentKindChanged === true && typeof d.roomId === 'string') {
        kindChangedByRoomId.add(d.roomId);
      }
    }
  }

  const byRoom = parseByRoomRows(radiators.byRoom);
  const emittersSummary = parseEmittersSummary(radiators.emittersSummary);
  const totalSectionsRaw = radiators.totalSections;
  const totalSections =
    typeof totalSectionsRaw === 'number' && Number.isFinite(totalSectionsRaw)
      ? Math.trunc(totalSectionsRaw)
      : emittersSummary != null
        ? emittersSummary.sectionalSections
        : null;
  const warnings = readStringArray(radiators.warnings);

  const inputsRaw = isRecord(radiators.inputs) ? radiators.inputs : null;
  let inputs: ParsedRadiatorsMatching['inputs'] = null;
  if (inputsRaw) {
    const supplyC =
      typeof inputsRaw.supplyC === 'number' && Number.isFinite(inputsRaw.supplyC)
        ? inputsRaw.supplyC
        : null;
    const returnC =
      typeof inputsRaw.returnC === 'number' && Number.isFinite(inputsRaw.returnC)
        ? inputsRaw.returnC
        : null;
    const flowDeltaTK =
      typeof inputsRaw.flowDeltaTK === 'number' && Number.isFinite(inputsRaw.flowDeltaTK)
        ? inputsRaw.flowDeltaTK
        : null;
    const targetDeltaT =
      typeof inputsRaw.targetDeltaT === 'number' && Number.isFinite(inputsRaw.targetDeltaT)
        ? inputsRaw.targetDeltaT
        : null;
    const radiatorConnection =
      inputsRaw.radiatorConnection === 'side' || inputsRaw.radiatorConnection === 'bottom'
        ? inputsRaw.radiatorConnection
        : null;
    const radiatorEmitterPreference =
      inputsRaw.radiatorEmitterPreference === 'auto'
      || inputsRaw.radiatorEmitterPreference === 'sectional'
      || inputsRaw.radiatorEmitterPreference === 'panel'
        ? inputsRaw.radiatorEmitterPreference
        : null;
    inputs = {
      supplyC,
      returnC,
      flowDeltaTK,
      targetDeltaT,
      radiatorConnection,
      radiatorEmitterPreference,
    };
  }

  const resolvedEmitterKind =
    radiators.resolvedEmitterKind === 'sectional'
    || radiators.resolvedEmitterKind === 'panel'
      ? radiators.resolvedEmitterKind
      : null;

  const roomEmitterDiffs: ParsedRadiatorsMatching['roomEmitterDiffs'] = [];
  if (Array.isArray(diffsRaw)) {
    for (const d of diffsRaw) {
      if (!isRecord(d) || typeof d.roomId !== 'string') continue;
      roomEmitterDiffs.push({
        roomId: d.roomId,
        equipmentKindChanged: d.equipmentKindChanged === true,
      });
    }
  }

  return {
    chosenModel,
    byRoom,
    totalSections,
    emittersSummary,
    roomEmitterDiffs,
    warnings,
    lineEconomy: parseProposalLine(radiators.lineEconomy, 'economy'),
    lineEfficient: parseProposalLine(
      radiators.lineEfficient,
      'efficient',
      kindChangedByRoomId,
    ),
    inputs,
    resolvedEmitterKind,
  };
}
