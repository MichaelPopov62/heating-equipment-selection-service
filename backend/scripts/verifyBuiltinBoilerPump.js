/**
 * Назначение: smoke-тест встроенного насоса котла Baxi (circulationPump.operatingModes).
 * Описание: resolveSystemPumps — boiler_builtin, below_manufacturer_qmin, curve_unavailable.
 */

import assert from 'node:assert/strict';
import { evaluatePumpModeAtDuty } from '../src/hydraulics/pickPump.js';
import { resolveSystemPumps } from '../src/hydraulics/resolveSystemPumps.js';

/** @type {import('../src/hydraulics/types').HydraulicsPumpDutyRules} */
const DUTY_RULES = {
  pumpHeadMarginPercent: 12,
  pumpDutyQMaxUtilizationPercent: 85,
  pumpMinHeadAtDutyM: 0.3,
  pumpMaxHeadMarginPercent: 60,
};

/** @type {import('../src/hydraulics/types').HydraulicsPipelineInput['rules']} */
const BASE_RULES = {
  velocityLimitsMps: { mainMax: 0.8, branchMax: 0.5, mainMin: 0.2 },
  defaultLengthsM: { mainLine: 8, radiatorBranch: 4, ufhCollectorBranch: 3 },
  maxUfhLoopLengthM: 80,
  roughnessMmByMaterial: { pex: 0.007 },
  localLossZeta: {
    elbow90: 0.9,
    teeBranch: 1.2,
    mixingNode: 2.5,
    collector: 1.5,
  },
  ...DUTY_RULES,
  pumpMinHeadAtQMaxM: 0.5,
  primaryFlowMarginPercent: 12,
  balancingValveKPaPerTurn: 3,
};

const LUNA_MODES = [
  {
    modeName: 'Baxi встроенный — скорость 1 (20%)',
    speedIndex: 1,
    powerWatts: 25,
    coefficients: { a: -1.667, b: 0.167, c: 1.3 },
    qMinM3h: 0.5,
    qMaxM3h: 0.6,
  },
  {
    modeName: 'Baxi встроенный — скорость 2 (40%)',
    speedIndex: 2,
    powerWatts: 35,
    coefficients: { a: -0.833, b: -0.667, c: 2.6 },
    qMinM3h: 0.5,
    qMaxM3h: 1.2,
  },
  {
    modeName: 'Baxi встроенный — скорость 3 (100%)',
    speedIndex: 3,
    powerWatts: 45,
    coefficients: { a: -0.85, b: -1.15, c: 6.5 },
    qMinM3h: 0.5,
    qMaxM3h: 2.0,
  },
];

const ECO_MODES = [
  {
    modeName: 'Baxi встроенный — скорость 1',
    speedIndex: 1,
    powerWatts: 30,
    coefficients: { a: -1.667, b: 0.167, c: 2.0 },
    qMinM3h: 0.4,
    qMaxM3h: 0.6,
  },
  {
    modeName: 'Baxi встроенный — скорость 2',
    speedIndex: 2,
    powerWatts: 40,
    coefficients: { a: -0.833, b: -0.667, c: 3.5 },
    qMinM3h: 0.4,
    qMaxM3h: 1.0,
  },
  {
    modeName: 'Baxi встроенный — скорость 3',
    speedIndex: 3,
    powerWatts: 45,
    coefficients: { a: -1.429, b: -0.571, c: 4.0 },
    qMinM3h: 0.4,
    qMaxM3h: 1.4,
  },
];

/**
 * @param {string} boilerModel
 * @param {object[]} operatingModes
 * @param {number} designFlow
 * @returns {import('../src/hydraulics/types').HydraulicsSystemPumpsResult}
 */
function runCase(boilerModel, operatingModes, designFlow) {
  /** @type {import('../src/hydraulics/types').HydraulicsPipelineInput} */
  const dto = {
    schemaVersion: 1,
    meta: {
      heatingEmittersMode: 'radiators_only',
      objectType: 'apartment',
      dhwMatchingScheme:
        'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
    },
    source: {
      catalogBoilerId: boilerModel,
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
        consumers: [
          {
            roomId: 'r1',
            roomName: 'Комната',
            floor: 1,
            heatLoadWatts: 10000,
            flowRateM3PerHour: designFlow,
          },
        ],
        totalFlowRateM3PerHour: designFlow,
      },
    },
    layout: {
      mainLineLengthM: 8,
      radiatorBranches: [],
      ufhCollectorTransit: [],
    },
    rules: BASE_RULES,
  };

  /** @type {import('../src/hydraulics/types').HydraulicsPressureReport} */
  const pressure = {
    headRequiredM: 0.22,
    criticalPressureDropKPa: 2,
    circulationLoops: [],
  };

  /** @type {import('../src/catalog/types').NormalizedCatalog} */
  const catalog = {
    boilers: {
      doubleCircuit: [
        {
          model: boilerModel,
          brand: 'Baxi',
          mountingType: 'wall',
          powerKw: { min: 4.7, max: 28 },
          price: 56500,
          circuitsCount: 2,
          isDoubleCircuit: true,
          type: 'condensing',
          circulationPump: { operatingModes },
        },
      ],
      singleCircuit: [],
    },
    radiators: [],
    waterHeaters: [],
    pumps: [
      {
        id: 'pump-grundfos-ups-25-40-180',
        brand: 'Grundfos',
        model: 'UPS 25-40 180',
        type: 'three_speed',
        segment: 'premium',
        price: 1250,
        connections: {
          mountingLengthMm: 180,
          threadInch: '1 1/2',
          nominalDiameterMm: 25,
        },
        operatingModes: [
          {
            modeName: 'Скорость 3',
            speedIndex: 3,
            powerWatts: 45,
            coefficients: { a: -0.45, b: -0.06, c: 4.0 },
            qMinM3h: 0.4,
            qMaxM3h: 3.5,
          },
        ],
      },
    ],
  };

  return resolveSystemPumps({ dto, pressure, catalog });
}

// Vaillant legacy smoke (регрессия)
{
  const pressureHigh = {
    headRequiredM: 3.6,
    criticalPressureDropKPa: 30,
    circulationLoops: [],
  };

  const catalogVaillant = {
    boilers: {
      doubleCircuit: [
        {
          model: 'Vaillant ecoTEC pro VUW 246/5-3',
          mountingType: 'wall',
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
        },
      ],
      singleCircuit: [],
    },
    radiators: [],
    waterHeaters: [],
    pumps: [],
  };

  const highHead = resolveSystemPumps({
    dto: {
      schemaVersion: 1,
      meta: {
        heatingEmittersMode: 'radiators_only',
        objectType: 'house',
        dhwMatchingScheme:
          'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
      },
      source: {
        catalogBoilerId: 'Vaillant ecoTEC pro VUW 246/5-3',
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
          consumers: [
            {
              roomId: 'r1',
              roomName: 'Комната',
              floor: 1,
              heatLoadWatts: 10000,
              flowRateM3PerHour: 1.0,
            },
          ],
          totalFlowRateM3PerHour: 1.0,
        },
      },
      layout: {
        mainLineLengthM: 8,
        radiatorBranches: [],
        ufhCollectorTransit: [],
      },
      rules: BASE_RULES,
    },
    pressure: pressureHigh,
    catalog: catalogVaillant,
  });

  const mainPump = highHead.pumps.find((p) => p.zoneId === 'boiler_primary');
  assert.ok(mainPump, 'Vaillant: ожидается насос котловой зоны');
  assert.equal(mainPump.pumpSource, 'boiler_builtin');
  console.log('OK Vaillant regression: boiler_builtin');
}

// 1. Luna Q=0.078 → below_manufacturer_qmin, без каталога
{
  const r = runCase('Luna Duo-Tec E 33', LUNA_MODES, 0.078);
  assert.equal(r.builtinPumpDuty?.status, 'below_manufacturer_qmin');
  assert.equal(r.pumps.length, 0, 'каталогный насос не подбирается');
  assert.ok(
    r.warnings.some((w) => w.includes('q_min')),
    'ожидается предупреждение о q_min',
  );
  console.log('OK case 1: Luna Q=0.078 below_manufacturer_qmin');
}

// 2. Luna Q=0.55 → boiler_builtin
{
  const r = runCase('Luna Duo-Tec E 33', LUNA_MODES, 0.55);
  const main = r.pumps.find((p) => p.zoneId === 'boiler_primary');
  assert.ok(main, 'ожидается насос');
  assert.equal(main.pumpSource, 'boiler_builtin');
  assert.equal(r.builtinPumpDuty?.status, 'ok');
  console.log(`OK case 2: Luna Q=0.55 → ${main.modeName}`);
}

// 3. Luna Q=0.65 → speed 1 curve_unavailable, speed 2+ OK
{
  const headTarget = 0.22 * 1.12;
  const s1 = evaluatePumpModeAtDuty({
    mode: LUNA_MODES[0],
    q: 0.65,
    headRequiredM: 0.22,
    headTarget,
    dutyRules: DUTY_RULES,
    skipHeadOversizedCheck: true,
  });
  assert.equal(s1.issue, 'curve_unavailable');

  const r = runCase('Luna Duo-Tec E 33', LUNA_MODES, 0.65);
  const main = r.pumps.find((p) => p.zoneId === 'boiler_primary');
  assert.ok(main?.pumpSource === 'boiler_builtin');
  assert.notEqual(main?.modeName, LUNA_MODES[0].modeName);
  console.log(`OK case 3: Luna Q=0.65 → ${main?.modeName}`);
}

// 4. ECO Q=0.078 → below_manufacturer_qmin
{
  const r = runCase('Baxi ECO Home 24 F', ECO_MODES, 0.078);
  assert.equal(r.builtinPumpDuty?.status, 'below_manufacturer_qmin');
  assert.equal(r.pumps.length, 0);
  console.log('OK case 4: ECO Q=0.078 below_manufacturer_qmin');
}

// 5. ECO Q=0.45 → boiler_builtin
{
  const r = runCase('Baxi ECO Home 24 F', ECO_MODES, 0.45);
  const main = r.pumps.find((p) => p.zoneId === 'boiler_primary');
  assert.ok(main?.pumpSource === 'boiler_builtin');
  console.log(`OK case 5: ECO Q=0.45 → ${main?.modeName}`);
}

// 6. ECO Q=0.65 → speed 1 curve_unavailable, speed 2+ OK
{
  const s1 = evaluatePumpModeAtDuty({
    mode: ECO_MODES[0],
    q: 0.65,
    headRequiredM: 0.22,
    headTarget: 0.22 * 1.12,
    dutyRules: DUTY_RULES,
    skipHeadOversizedCheck: true,
  });
  assert.equal(s1.issue, 'curve_unavailable');

  const r = runCase('Baxi ECO Home 24 F', ECO_MODES, 0.65);
  const main = r.pumps.find((p) => p.zoneId === 'boiler_primary');
  assert.ok(main?.pumpSource === 'boiler_builtin');
  assert.notEqual(main?.modeName, ECO_MODES[0].modeName);
  console.log(`OK case 6: ECO Q=0.65 → ${main?.modeName}`);
}

console.log('OK verifyBuiltinBoilerPump: Baxi 6 режимов + Vaillant regression');
