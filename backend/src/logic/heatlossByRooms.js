/**
 * Назначение: расчёт теплопотерь здания по комнатам.
 * Описание: Собирает envelopeElements с U из пресетов, objectMeta.externalWalls и ориентационных поправок; учитывает границы комнат и запас на вентиляцию (kVent). Экспортирует calculateHeatLossForBuilding(); вызывается из report/buildReport.js.
 */

import { calculateHeatLoss } from './envelopeHeatLoss.js';
import { getEnvelopePresetById } from './envelopePresets.js';
import {
  INTERNAL_CORRIDOR_DESIGN_TEMP_C,
  isInternalCorridorWallConstruction,
  resolveElementDeltaT,
  resolveElementHeatLossFactors,
  resolveElementUValue,
  resolveRoomExteriorLayout,
} from './roomExteriorLayoutHeatLoss.js';
import { resolveExternalWallUValue } from './wallAssembly.js';
import { envelopeKindIncludedForHeatLoss } from './topBoundaryEnvelope.js';
import {
  normalizeVentilationReserveMode,
  resolveKVent,
  ventilationReserveModeLabel,
} from './ventilationReserve.js';
import { logger } from '../utils/logger.js';
import { resolveDesignRoomAirTempC } from '../../../shared/roomDesignAirTemp.js';

/**
 * Расчёт теплопотерь с детализацией по комнатам.
 *
 * Вход:
 * - temps (inside/outside)
 * - building.rooms + building.envelopeElements
 *
 * Выход:
 * - общие теплопотери
 * - теплопотери по каждой комнате
 * - список элементов ограждений с привязкой к комнате
 */

function sum(numbers) {
  return numbers.reduce((a, b) => a + b, 0);
}

/**
 * @param {import('../types/shared-types').EnvelopePresetUModel} model
 * @param {number} thicknessMm
 * @returns {number}
 */
function computeUFromThickness(model, thicknessMm) {
  const dM = thicknessMm / 1000;
  const extraR = model.extraR ?? 0;
  const rTotal = model.surfaceR + extraR + dM / model.lambdaWmK;
  return 1 / rTotal;
}

/**
 * @param {object} args
 * @param {{ insideC: number, outsideC: number }} args.temps
 * @param {import('../types/shared-types').BuildingInput} args.building
 * @returns {import('../types/shared-types').HeatLossReport}
 */
export function calculateHeatLossForBuilding({ temps, building }) {
  const insideC = temps.insideC;
  const outsideC = temps.outsideC;
  const bathroomAirTempC =
    typeof temps.bathroomAirTempC === 'number' && Number.isFinite(temps.bathroomAirTempC)
      ? temps.bathroomAirTempC
      : typeof building?.temps?.bathroomAirTempC === 'number' &&
          Number.isFinite(building.temps.bathroomAirTempC)
        ? building.temps.bathroomAirTempC
        : undefined;

  logger.debug('heatloss.building.start', null, {
    insideC,
    outsideC,
    bathroomAirTempC: bathroomAirTempC ?? null,
    rooms: building?.rooms?.length ?? 0,
    elements: building?.envelopeElements?.length ?? 0,
  });

  const roomsById = new Map(building.rooms.map((r) => [r.id, r]));
  /** @type {Map<string, { designAirTempC: number, source: import('../types/shared-types').DesignRoomAirTempSource }>} */
  const roomAirById = new Map();
  for (const room of building.rooms) {
    const resolved = resolveDesignRoomAirTempC({
      roomType: room.type,
      insideC,
      bathroomAirTempC,
    });
    if (resolved) roomAirById.set(room.id, resolved);
  }
  const roomLayoutById = new Map(
    building.rooms.map((r) => [
      r.id,
      resolveRoomExteriorLayout(r, building.envelopeElements ?? []),
    ]),
  );
  const allElements = [...(building.envelopeElements ?? [])];

  const normalizedElements = allElements.map((el) => {
    const room = roomsById.get(el.roomId);
    if (!room) {
      const err = new Error(`Неизвестная комната roomId="${el.roomId}"`);
      err.statusCode = 400;
      err.code = 'UNKNOWN_ROOM';
      throw err;
    }

    const preset = el.presetId ? getEnvelopePresetById(el.presetId) : null;

    const elementThicknessMm = el.thicknessMm ?? null;
    const defaultWallThicknessMm = building.objectMeta?.externalWalls?.thicknessMm ?? null;
    const thicknessMmToUse =
      elementThicknessMm != null
        ? elementThicknessMm
        : preset?.kind === 'wall'
          ? defaultWallThicknessMm
          : null;

    const kindForRule = /** @type {'wall' | 'window' | 'ceiling' | 'floor' | 'roof' | undefined} */ (
      el.kind ?? preset?.kind ?? undefined
    );

    let uValue =
      el.uValue ??
      (kindForRule === 'wall' && building.objectMeta?.externalWalls
        ? resolveExternalWallUValue(building.objectMeta.externalWalls, el.presetId ?? undefined)
        : preset?.uModel && thicknessMmToUse != null
          ? computeUFromThickness(preset.uModel, thicknessMmToUse)
          : preset?.uValue ?? null);

    if (uValue == null) {
      const err = new Error(
        `Некорректный элемент ограждения: не задан uValue и не удалось вывести его из presetId/thickness (roomId="${el.roomId}", construction="${el.construction}")`,
      );
      err.statusCode = 400;
      err.code = 'ENVELOPE_UVALUE_MISSING';
      throw err;
    }

    const constructionResolved = el.construction ?? preset?.construction ?? null;
    uValue = resolveElementUValue(uValue, constructionResolved) ?? uValue;

    const roomInput = /** @type {import('../types/shared-types').RoomInput} */ (room);
    const tb = /** @type {'heated' | 'unheated' | 'roof'} */ (roomInput.topBoundary);
    const bb = /** @type {'heated' | 'unheated'} */ (
      roomInput.bottomBoundary ?? 'unheated'
    );
    if (!envelopeKindIncludedForHeatLoss({ topBoundary: tb, bottomBoundary: bb, kind: kindForRule })) {
      logger.debug('heatloss.envelope.skipped_boundary', null, {
        roomId: room.id,
        topBoundary: tb,
        bottomBoundary: bb,
        kind: kindForRule,
        construction: el.construction ?? null,
      });
      uValue = 0;
    }

    return {
      name: el.name ?? null,
      roomId: el.roomId,
      roomName: room.name,
      construction: el.construction ?? preset?.construction ?? null,
      material: el.material ?? preset?.material ?? null,
      kind: el.kind ?? preset?.kind ?? null,
      count: el.count ?? 1,
      orientation: el.orientation ?? null,
      openingWidthMm: el.openingWidthMm ?? null,
      openingHeightMm: el.openingHeightMm ?? null,
      areaM2: el.areaM2 * (el.count ?? 1),
      uValue,
      roomLayout: roomLayoutById.get(el.roomId) ?? 'facade',
    };
  });

  const ventilationReserveMode = normalizeVentilationReserveMode(
    building.objectMeta?.ventilationReserveMode,
  );
  const kVent = resolveKVent(ventilationReserveMode);

  const heatLoss = calculateHeatLoss({
    insideTempC: insideC,
    outsideTempC: outsideC,
    elements: normalizedElements.map((e) => {
      const construction = e.construction;
      const roomAir = roomAirById.get(e.roomId);
      const roomInsideC = roomAir?.designAirTempC ?? insideC;
      const elementDeltaT = resolveElementDeltaT({
        insideC: roomInsideC,
        outsideC,
        construction,
      });
      const { heatLossFactor, cornerRoomFactor } = resolveElementHeatLossFactors({
        kind: e.kind,
        orientation: e.orientation,
        construction,
        roomLayout: e.roomLayout,
      });
      const adjacentTempC = isInternalCorridorWallConstruction(construction)
        ? INTERNAL_CORRIDOR_DESIGN_TEMP_C
        : outsideC;

      return {
        name: e.name,
        construction: e.construction,
        material: e.material,
        areaM2: e.areaM2,
        uValue: e.uValue,
        kind: e.kind,
        count: e.count,
        orientation: e.orientation,
        openingWidthMm: e.openingWidthMm,
        openingHeightMm: e.openingHeightMm,
        deltaT: elementDeltaT,
        heatLossFactor,
        cornerRoomFactor,
        adjacentTempC,
      };
    }),
    ventilation: null,
  });

  const elementsWithRoom = heatLoss.envelope.elements.map((calcEl, idx) => ({
    ...calcEl,
    roomId: normalizedElements[idx].roomId,
    roomName: normalizedElements[idx].roomName,
  }));

  const rooms = building.rooms.map((room) => {
    const els = elementsWithRoom.filter((x) => x.roomId === room.id);
    const envelopeWatts = sum(els.map((x) => x.qWatts));
    const designWatts = envelopeWatts * kVent;
    const air = roomAirById.get(room.id);
    return {
      id: room.id,
      name: room.name,
      type: room.type,
      areaM2: room.areaM2,
      heightM: room.heightM,
      volumeM3: room.areaM2 * room.heightM,
      designAirTempC: air?.designAirTempC ?? insideC,
      designAirTempSource: air?.source ?? 'survey',
      envelopeWatts,
      ventilationReserveFactor: kVent,
      designWatts,
      elements: els,
    };
  });

  const totalWatts = sum(rooms.map((r) => r.designWatts));

  logger.debug('heatloss.building.kVent', null, {
    ventilationReserveMode,
    kVent,
    envelopeWatts: heatLoss.envelope.watts,
    totalWatts,
  });

  return {
    insideC,
    outsideC,
    deltaT: heatLoss.deltaT,
    ventilation: {
      method: 'kVentPerRoom',
      watts: 0,
      ventilationReserveMode,
      kVent,
      label: ventilationReserveModeLabel(ventilationReserveMode),
    },
    envelopeWatts: heatLoss.envelope.watts,
    totalWatts,
    rooms,
  };
}

