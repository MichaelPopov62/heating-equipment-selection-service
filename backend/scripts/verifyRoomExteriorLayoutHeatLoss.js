/**
 * Назначение: проверка roomExteriorLayout в расчёте теплопотерь.
 * Запуск: node scripts/verifyRoomExteriorLayoutHeatLoss.js
 */

import { calculateHeatLossForBuilding } from '../src/logic/heatlossByRooms.js';
import {
  CORNER_ROOM_HEAT_LOSS_FACTOR,
  INTERNAL_CORRIDOR_DESIGN_TEMP_C,
} from '../src/logic/roomExteriorLayoutHeatLoss.js';

const objectMeta = {
  objectType: 'apartment',
  floors: 1,
  roomsCount: 1,
  externalWalls: {
    presetId: 'wall_gas_concrete_d500',
    thicknessMm: 375,
    facadeSystem: 'none',
  },
};

const baseRoom = {
  id: 'r1',
  name: 'Тест',
  type: 'гостиная',
  floor: 1,
  topBoundary: 'heated',
  bottomBoundary: 'heated',
  areaM2: 20,
  heightM: 2.7,
};

const temps = { insideC: 20, outsideC: -22 };
const area = 10;

function wallEl(roomId, construction, orientation = 'N') {
  return {
    kind: 'wall',
    roomId,
    name: 'Стена',
    construction,
    presetId: 'wall_gas_concrete_d500',
    areaM2: area,
    orientation,
  };
}

function runCase(label, room, elements) {
  const report = calculateHeatLossForBuilding({
    temps,
    building: {
      objectMeta,
      rooms: [room],
      envelopeElements: elements,
    },
  });
  const el = report.rooms[0].elements[0];
  console.log(`\n=== ${label} ===`);
  console.log(
    JSON.stringify(
      {
        layout: room.roomExteriorLayout,
        deltaT: el.deltaT,
        uValue: el.uValue,
        heatLossFactor: el.heatLossFactor,
        cornerRoomFactor: el.cornerRoomFactor,
        adjacentTempC: el.adjacentTempC,
        qWatts: Math.round(el.qWatts),
      },
      null,
      2,
    ),
  );
  return el;
}

const facadeEl = runCase('facade N', { ...baseRoom, roomExteriorLayout: 'facade' }, [
  wallEl('r1', 'наружная стена', 'N'),
]);

const cornerEl = runCase('corner N', { ...baseRoom, roomExteriorLayout: 'corner' }, [
  wallEl('r1', 'наружная стена', 'N'),
  { ...wallEl('r1', 'наружная стена', 'W'), name: 'Стена №2' },
]);

const internalEl = runCase('internal corridor', { ...baseRoom, type: 'прихожая', roomExteriorLayout: 'internal' }, [
  wallEl('r1', 'стена в неотапливаемый коридор', 'N'),
]);

const errors = [];

if (Math.abs(facadeEl.heatLossFactor - 1.1) > 0.001) {
  errors.push(`facade: ожидался heatLossFactor 1.1, получено ${facadeEl.heatLossFactor}`);
}
if (Math.abs(cornerEl.heatLossFactor - 1.1 * CORNER_ROOM_HEAT_LOSS_FACTOR) > 0.001) {
  errors.push(
    `corner: ожидался heatLossFactor ${1.1 * CORNER_ROOM_HEAT_LOSS_FACTOR}, получено ${cornerEl.heatLossFactor}`,
  );
}
if (Math.abs(internalEl.deltaT - (20 - INTERNAL_CORRIDOR_DESIGN_TEMP_C)) > 0.001) {
  errors.push(`internal: ожидался deltaT 5, получено ${internalEl.deltaT}`);
}
if (internalEl.heatLossFactor !== 1) {
  errors.push(`internal: heatLossFactor должен быть 1, получено ${internalEl.heatLossFactor}`);
}
const ratio = facadeEl.qWatts / internalEl.qWatts;
if (ratio < 5) {
  errors.push(`internal Q должно быть существенно ниже facade (ratio=${ratio.toFixed(1)}, ожидалось >5)`);
}

if (errors.length > 0) {
  console.error('\nFAIL:', errors.join('\n'));
  process.exit(1);
}
console.log(`\nOK: internal Q в ${ratio.toFixed(1)} раз ниже facade`);
