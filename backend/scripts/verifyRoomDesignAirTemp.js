/**
 * Назначение: verify resolveDesignRoomAirTempC + согласованность heatloss/unibox.
 * Запуск: npm run verify:room-design-air-temp
 */
import assert from 'node:assert/strict';
import {
  BATHROOM_DESIGN_AIR_TEMP_FLOOR_C,
  resolveDesignRoomAirTempC,
} from '../../shared/roomDesignAirTemp.js';
import { calculateHeatLossForBuilding } from '../src/logic/heatlossByRooms.js';
import {
  collectUniboxLoopDemands,
  resolveUniboxRoomAirTempC,
} from '../src/matching/unibox.js';

assert.equal(BATHROOM_DESIGN_AIR_TEMP_FLOOR_C, 24);

// --- shared resolve ---
{
  const a = resolveDesignRoomAirTempC({ roomType: 'санузел', insideC: 20 });
  assert.ok(a);
  assert.equal(a.designAirTempC, 24);
  assert.equal(a.source, 'floor');

  const b = resolveDesignRoomAirTempC({ roomType: 'санузел', insideC: 26 });
  assert.ok(b);
  assert.equal(b.designAirTempC, 26);
  assert.equal(b.source, 'survey');

  const c = resolveDesignRoomAirTempC({
    roomType: 'санузел',
    insideC: 20,
    bathroomAirTempC: 27,
  });
  assert.ok(c);
  assert.equal(c.designAirTempC, 27);
  assert.equal(c.source, 'bathroom_field');

  const d = resolveDesignRoomAirTempC({ roomType: 'гостиная', insideC: 20 });
  assert.ok(d);
  assert.equal(d.designAirTempC, 20);
  assert.equal(d.source, 'survey');

  const e = resolveDesignRoomAirTempC({ roomType: 'коридор', insideC: 20 });
  assert.ok(e);
  assert.equal(e.designAirTempC, 20);
}

// --- unibox adapter ---
{
  const u = resolveUniboxRoomAirTempC('санузел', 20);
  assert.ok(u);
  assert.equal(u.roomAirTempC, 24);
  assert.equal(u.roomAirTempSource, 'preset');

  const u2 = resolveUniboxRoomAirTempC('санузел', 20, 28);
  assert.ok(u2);
  assert.equal(u2.roomAirTempC, 28);
  assert.equal(u2.roomAirTempSource, 'bathroom_field');
}

const temps20 = { insideC: 20, outsideC: -22 };
const buildingBase = {
  rooms: [
    {
      id: 'bath',
      name: 'Санузел',
      type: 'санузел',
      floor: 1,
      topBoundary: 'heated',
      bottomBoundary: 'heated',
      areaM2: 5,
      heightM: 2.7,
      roomExteriorLayout: 'internal',
    },
    {
      id: 'liv',
      name: 'Гостиная',
      type: 'гостиная',
      floor: 1,
      topBoundary: 'heated',
      bottomBoundary: 'heated',
      areaM2: 20,
      heightM: 2.7,
      roomExteriorLayout: 'facade',
    },
  ],
  envelopeElements: [
    {
      kind: 'wall',
      roomId: 'bath',
      name: 'Стена bath',
      construction: 'стена в неотапливаемый коридор',
      presetId: 'wall_gas_concrete_d500',
      areaM2: 8,
      orientation: 'N',
    },
    {
      kind: 'wall',
      roomId: 'liv',
      name: 'Стена liv',
      construction: 'наружная стена',
      presetId: 'wall_gas_concrete_d500',
      areaM2: 12,
      orientation: 'N',
    },
  ],
  objectMeta: {
    objectType: 'house',
    floors: 1,
    roomsCount: 2,
    externalWalls: {
      presetId: 'wall_gas_concrete_d500',
      thicknessMm: 375,
      facadeSystem: 'none',
    },
  },
};

const hl = calculateHeatLossForBuilding({ temps: temps20, building: buildingBase });
const bathRoom = hl.rooms.find((r) => r.id === 'bath');
const livRoom = hl.rooms.find((r) => r.id === 'liv');
assert.ok(bathRoom);
assert.ok(livRoom);
assert.equal(bathRoom.designAirTempC, 24);
assert.equal(bathRoom.designAirTempSource, 'floor');
assert.equal(livRoom.designAirTempC, 20);
assert.equal(livRoom.designAirTempSource, 'survey');

// Санузел при 24 должен терять больше, чем если бы считали при 20 (тот же элемент).
const hlForced20 = calculateHeatLossForBuilding({
  temps: temps20,
  building: {
    ...buildingBase,
    rooms: buildingBase.rooms.map((r) =>
      r.id === 'bath' ? { ...r, type: 'гостиная' } : r,
    ),
  },
});
const bathAsLiving = hlForced20.rooms.find((r) => r.id === 'bath');
assert.ok(bathAsLiving);
assert.ok(
  (bathRoom.envelopeWatts ?? 0) > (bathAsLiving.envelopeWatts ?? 0),
  'санузел при 24 °C воздуха: Q выше, чем при 20 °C',
);

const underfloorHeating = {
  enabled: true,
  circuitSupplyC: 40,
  circuitReturnC: 30,
  circuitMeanC: 35,
  circuitSource: 'finish_preset',
  rooms: [
    {
      roomId: 'bath',
      roomName: 'Санузел',
      heatedAreaM2: 4,
      areaM2: 4,
      circuitSupplyC: 40,
      circuitReturnC: 30,
      loops: [
        {
          loopId: 'bath-L1',
          loopLengthM: 40,
          heatLoadWatts: 400,
          flowRateM3PerHour: 0.04,
        },
      ],
    },
  ],
  totalHeatFluxUpWatts: 400,
  totalHeatFluxDownWatts: 0,
  warnings: [],
};

const demands = collectUniboxLoopDemands(underfloorHeating, {
  surveyInsideC: 20,
  rooms: [{ id: 'bath', type: 'санузел' }],
});
assert.equal(demands[0].required.roomAirTempC, 24);

const demandsField = collectUniboxLoopDemands(underfloorHeating, {
  surveyInsideC: 20,
  bathroomAirTempC: 27,
  rooms: [{ id: 'bath', type: 'санузел' }],
});
assert.equal(demandsField[0].required.roomAirTempC, 27);
assert.equal(demandsField[0].required.roomAirTempSource, 'bathroom_field');

console.log('verify:room-design-air-temp OK');
