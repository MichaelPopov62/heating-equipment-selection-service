/**
 * Назначение: smoke-тест встроенного насоса котла (circulationPump.operatingModes).
 * Описание: resolveSystemPumps выбирает pumpSource=boiler_builtin при перекрытии рабочей точки.
 */

import assert from 'node:assert/strict';
import { resolveSystemPumps } from '../src/hydraulics/resolveSystemPumps.js';

const BOILER_MODEL = 'Vaillant ecoTEC pro VUW 246/5-3';

/** @type {import('../src/hydraulics/types').HydraulicsPipelineInput} */
const dto = {
  schemaVersion: 1,
  meta: {
    heatingEmittersMode: 'radiators_only',
    objectType: 'house',
    dhwMatchingScheme: 'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
  },
  source: {
    catalogBoilerId: BOILER_MODEL,
    supplyC: 75,
    returnC: 65,
    deltaTK: 20,
    requiredKw: 24,
    connectionNominalMm: [25],
  },
  circuits: {
    radiators: {
      thermalRegime: { supplyC: 75, returnC: 65, deltaTK: 20 },
      connectionType: 'side',
      consumers: [{
        roomId: 'r1',
        roomName: 'Комната',
        floor: 1,
        heatLoadWatts: 10000,
        flowRateM3PerHour: 1.0,
      }],
      totalFlowRateM3PerHour: 1.0,
    },
  },
  layout: {
    mainLineLengthM: 8,
    radiatorBranches: [],
    ufhBranches: [],
  },
  rules: {
    velocityLimitsMps: { mainMax: 0.8, branchMax: 0.5, mainMin: 0.2 },
    defaultLengthsM: { mainLine: 8, radiatorBranch: 4, ufhCollectorBranch: 3 },
    maxUfhLoopLengthM: 100,
    roughnessMmByMaterial: { pex: 0.007 },
    localLossZeta: { elbow90: 0.9, teeBranch: 1.2, mixingNode: 2.5, collector: 1.5 },
    pumpHeadMarginPercent: 12,
    pumpDutyQMaxUtilizationPercent: 85,
    pumpMinHeadAtDutyM: 0.3,
    pumpMaxHeadMarginPercent: 60,
    pumpMinHeadAtQMaxM: 0.5,
    primaryFlowMarginPercent: 12,
    balancingValveKPaPerTurn: 3,
  },
};

/** @type {import('../src/hydraulics/types').HydraulicsPressureReport} */
const pressure = {
  headRequiredM: 3.6,
  criticalPressureDropKPa: 30,
  circulationLoops: [],
};

/** @type {import('../src/catalog/types').NormalizedCatalog} */
const catalog = {
  boilers: {
    doubleCircuit: [{
      model: BOILER_MODEL,
      powerKw: { min: 6.2, max: 24 },
      price: 48500,
      circuitsCount: 2,
      isDoubleCircuit: true,
      type: 'condensing',
      circulationPump: {
        operatingModes: [
          {
            modeName: 'Встроенный насос — скорость 3',
            speedIndex: 3,
            powerWatts: 40,
            coefficients: { a: -0.45, b: 0.12, c: 6.0 },
            qMinM3h: 0.1,
            qMaxM3h: 4.5,
          },
        ],
      },
    }],
    singleCircuit: [],
  },
  radiators: [],
  waterHeaters: [],
  pumps: [],
};

const result = resolveSystemPumps({ dto, pressure, catalog });
const mainPump = result.pumps.find((p) => p.zoneId === 'boiler_primary');

assert.ok(mainPump, 'ожидается насос котловой зоны');
assert.equal(mainPump.pumpSource, 'boiler_builtin');
assert.equal(mainPump.modeName, 'Встроенный насос — скорость 3');
assert.ok((mainPump.headAtDesignM ?? 0) >= 3.6);

console.log(
  `OK builtin boiler pump: ${mainPump.modeName}, H=${mainPump.headAtDesignM} м при Q=${mainPump.designFlowM3PerHour} м³/ч`,
);
