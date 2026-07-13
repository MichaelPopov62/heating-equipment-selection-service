/**
 * Назначение: агрегат приборов радиаторного подбора (панели vs секции).
 * Описание: totalSections = только sectionalSections; панели считаются отдельно.
 */

/**
 * @returns {import('../../types/shared-types').RadiatorsEmittersSummary}
 */
export function emptyRadiatorsEmittersSummary() {
  return {
    panelUnits: 0,
    sectionalUnits: 0,
    sectionalSections: 0,
    totalDeliverableWatts: 0,
    roomsWithEmitter: 0,
    roomsSkipped: 0,
  };
}

/**
 * Агрегація byRoom → emittersSummary.
 * @param {import('../../types/shared-types').RadiatorsByRoomItem[] | undefined | null} byRoom
 * @returns {import('../../types/shared-types').RadiatorsEmittersSummary}
 */
export function summarizeRadiatorEmitters(byRoom) {
  const summary = emptyRadiatorsEmittersSummary();
  for (const row of byRoom ?? []) {
    const kind = resolveDisplayKind(row);

    if (kind === 'none') {
      summary.roomsSkipped += 1;
      continue;
    }

    summary.roomsWithEmitter += 1;
    const deliverable =
      typeof row.deliverableWatts === 'number' && Number.isFinite(row.deliverableWatts)
        ? row.deliverableWatts
        : 0;
    summary.totalDeliverableWatts += deliverable;

    if (kind === 'panel') {
      const units =
        typeof row.unitsCount === 'number' && Number.isFinite(row.unitsCount)
          ? Math.max(1, Math.trunc(row.unitsCount))
          : 1;
      summary.panelUnits += units;
      continue;
    }

    if (typeof row.sections === 'number' && Number.isFinite(row.sections)) {
      const units =
        typeof row.unitsCount === 'number' && Number.isFinite(row.unitsCount)
          ? Math.max(1, Math.trunc(row.unitsCount))
          : 1;
      summary.sectionalUnits += units;
      summary.sectionalSections += Math.trunc(row.sections) * units;
    }
  }

  summary.totalDeliverableWatts = Math.round(summary.totalDeliverableWatts);
  return summary;
}

/**
 * Порівняння byRoom ліній economy / efficient по кімнатах.
 * @param {import('../../types/shared-types').RadiatorsByRoomItem[] | undefined | null} economyByRoom
 * @param {import('../../types/shared-types').RadiatorsByRoomItem[] | undefined | null} efficientByRoom
 * @returns {import('../../types/shared-types').RadiatorsRoomEmitterDiff[]}
 */
export function buildRadiatorRoomEmitterDiffs(economyByRoom, efficientByRoom) {
  /** @type {Map<string, import('../../types/shared-types').RadiatorsByRoomItem>} */
  const ecoMap = new Map();
  for (const row of economyByRoom ?? []) {
    if (row?.roomId) ecoMap.set(row.roomId, row);
  }
  /** @type {Map<string, import('../../types/shared-types').RadiatorsByRoomItem>} */
  const effMap = new Map();
  for (const row of efficientByRoom ?? []) {
    if (row?.roomId) effMap.set(row.roomId, row);
  }

  const roomIds = new Set([...ecoMap.keys(), ...effMap.keys()]);
  /** @type {import('../../types/shared-types').RadiatorsRoomEmitterDiff[]} */
  const diffs = [];

  for (const roomId of roomIds) {
    const eco = ecoMap.get(roomId);
    const eff = effMap.get(roomId);
    const roomName = eco?.roomName ?? eff?.roomName ?? roomId;
    const ecoKind = resolveDisplayKind(eco);
    const effKind = resolveDisplayKind(eff);
    const equipmentKindChanged = ecoKind !== effKind;

    diffs.push({
      roomId,
      roomName,
      equipmentKindChanged,
      economyDisplayKind: ecoKind,
      efficientDisplayKind: effKind,
      economyModel: eco?.radiatorModel && eco.radiatorModel !== '—' ? eco.radiatorModel : null,
      efficientModel: eff?.radiatorModel && eff.radiatorModel !== '—' ? eff.radiatorModel : null,
      economySections: typeof eco?.sections === 'number' ? eco.sections : null,
      efficientSections: typeof eff?.sections === 'number' ? eff.sections : null,
      economyPanelLengthMm:
        typeof eco?.panelLengthMm === 'number' ? eco.panelLengthMm : null,
      efficientPanelLengthMm:
        typeof eff?.panelLengthMm === 'number' ? eff.panelLengthMm : null,
      economyDeliverableWatts:
        typeof eco?.deliverableWatts === 'number' ? eco.deliverableWatts : null,
      efficientDeliverableWatts:
        typeof eff?.deliverableWatts === 'number' ? eff.deliverableWatts : null,
    });
  }

  return diffs.sort((a, b) => a.roomId.localeCompare(b.roomId));
}

/**
 * @param {import('../../types/shared-types').RadiatorsByRoomItem | undefined} row
 * @returns {'sectional' | 'panel' | 'none'}
 */
function resolveDisplayKind(row) {
  if (!row) return 'none';
  if (row.displayKind === 'sectional' || row.displayKind === 'panel' || row.displayKind === 'none') {
    return row.displayKind;
  }
  if (!row.radiatorModel || row.radiatorModel === '—') return 'none';
  if (row.priceBasis === 'panel') return 'panel';
  if (row.priceBasis === 'section') return 'sectional';
  return typeof row.sections === 'number' ? 'sectional' : 'none';
}
