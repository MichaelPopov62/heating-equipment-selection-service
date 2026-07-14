/**
 * Назначение: smoke-тест resolveCirculationFlows (зоны Q).
 * Описание: Четыре топологических сценария без полного calc pipeline.
 */

import assert from 'node:assert/strict';
import { resolveCirculationFlows } from '../src/hydraulics/resolveCirculationFlows.js';
import {
  buildHydraulicsRadiatorsCircuit,
  DEFAULT_LOCAL_LOSS_ZETA,
} from './fixtures/verifyFixtures.js';

/**
 * @param {Partial<import('../src/hydraulics/types.js').HydraulicsRadiatorsCircuit>} [radiatorsPartial]
 * @returns {import('../src/hydraulics/types.js').HydraulicsRadiatorsCircuit}
 */
function withRadiatorsCircuit(radiatorsPartial = {}) {
  return buildHydraulicsRadiatorsCircuit({
    thermalRegime: { supplyC: 75, returnC: 65, deltaTK: 10 },
    flowDeltaTK: 20,
    connectionType: 'side',
    consumers: [
      {
        roomId: 'r1',
        roomName: 'Комната',
        floor: 1,
        heatLoadWatts: 10000,
        flowRateM3PerHour: 0.431,
      },
    ],
    totalFlowRateM3PerHour: 0.431,
    ...radiatorsPartial,
  });
}

/**
 * @param {Partial<import('../src/hydraulics/types.js').HydraulicsPipelineInput>} [overrides]
 * @returns {import('../src/hydraulics/types.js').HydraulicsPipelineInput}
 */
function baseDto(overrides = {}) {
  /** @type {import('../src/hydraulics/types.js').HydraulicsPipelineInput} */
  const dto = {
    schemaVersion: 1,
    meta: {
      heatingEmittersMode: 'mixed',
      objectType: 'house',
      dhwMatchingScheme:
        'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
    },
    source: {
      supplyC: 75,
      returnC: 65,
      deltaTK: 20,
      requiredKw: 24,
      connectionNominalMm: [25],
    },
    circuits: {
      radiators: withRadiatorsCircuit({}),
      underfloor: {
        deltaTK: 10,
        aggregate: { heatLoadWatts: 8000, flowRateM3PerHour: 0.689 },
        isMixingNodeRequired: false,
        rooms: [],
      },
    },
    layout: {
      mainLineLengthM: 8,
      radiatorBranches: [],
      ufhCollectorTransit: [],
    },
    rules: {
      mainTransitMinInternalDiameterMm: 20,
      branchMinInternalDiameterMm: 12,
      velocityLimitsMps: { mainMax: 0.8, branchMax: 0.5, mainMin: 0.2 },
      radiatorBranchGrouping: {
        minFlowM3PerHourForIndividualBranch: 0.019,
        minHeatLoadWattsForIndividualBranch: 150,
        manifoldTrunkLengthM: 2,
        localZetaManifold: 1.5,
      },
      defaultLengthsM: {
        mainLine: 8,
        radiatorBranch: 4,
        ufhCollectorBranch: 3,
      },
      maxUfhLoopLengthM: 80,
      roughnessMmByMaterial: { pex: 0.007 },
      localLossZeta: {
        ...DEFAULT_LOCAL_LOSS_ZETA,
        elbow90: 0.9,
        teeBranch: 1.2,
        mixingNode: 2.5,
        collector: 1.5,
      },
      pumpHeadMarginPercent: 12,
      pumpDutyQMaxUtilizationPercent: 85,
      pumpMinHeadAtDutyM: 0.3,
      pumpMaxHeadMarginPercent: 60,
      pumpMinHeadAtQMaxM: 0.5,
      primaryFlowMarginPercent: 12,
      balancingValveKPaPerTurn: 3,
    },
    ...overrides,
  };
  return dto;
}

// Сценарий 1: прямое подключение — sum, не max
{
  const r = resolveCirculationFlows(baseDto());
  assert.equal(r.topology, 'direct');
  assert.equal(r.boilerPumpDesignFlowM3PerHour, 1.12);
  assert.equal(
    r.zones.find((z) => z.zoneId === 'boiler_primary')?.designFlowM3PerHour,
    1.12,
  );
  console.log('OK scenario 1 direct mixed: Q=1.12 m³/h');
}

// Сценарий 2: смесительный узел — два насоса
{
  const dto = baseDto({
    circuits: {
      radiators: withRadiatorsCircuit({}),
      underfloor: {
        deltaTK: 10,
        aggregate: { heatLoadWatts: 8000, flowRateM3PerHour: 0.689 },
        isMixingNodeRequired: true,
        distributionPreset: 'collector_mixing_valve',
        rooms: [],
      },
    },
  });
  const r = resolveCirculationFlows(dto);
  assert.equal(r.topology, 'mixing_valve');
  const main = r.zones.find((z) => z.zoneId === 'boiler_primary');
  const ufh = r.zones.find((z) => z.zoneId === 'ufh_floor');
  assert.ok(main && ufh);
  assert.equal(ufh.designFlowM3PerHour, 0.689);
  assert.ok(main.designFlowM3PerHour > 0 && main.designFlowM3PerHour < 1.12);
  assert.notEqual(main.designFlowM3PerHour, 0.689);
  console.log(
    `OK scenario 2 mixing valve: Q_main=${main.designFlowM3PerHour}, Q_ufh=${ufh.designFlowM3PerHour}`,
  );
}

// Сценарий 3: гидрострелка — primary + secondary zones
{
  const dto = baseDto({
    circuits: {
      radiators: withRadiatorsCircuit({}),
      underfloor: {
        deltaTK: 10,
        aggregate: { heatLoadWatts: 8000, flowRateM3PerHour: 0.689 },
        isMixingNodeRequired: true,
        distributionPreset: 'hydraulic_separator',
        rooms: [],
      },
    },
  });
  const r = resolveCirculationFlows(dto);
  assert.equal(r.topology, 'hydraulic_separator');
  assert.ok(r.zones.some((z) => z.zoneId === 'boiler_primary'));
  assert.ok(r.zones.some((z) => z.zoneId === 'radiators_secondary'));
  assert.ok(r.zones.some((z) => z.zoneId === 'ufh_floor_secondary'));
  assert.ok(r.primaryMainLineFlowM3PerHour >= 1.12 * 1.12 - 0.01);
  console.log(
    `OK scenario 3 hydraulic separator: Q_primary=${r.primaryMainLineFlowM3PerHour}`,
  );
}

// Сценарий 4: БКН — max(Q_heating, Q_dhw), не sum
{
  const dto = baseDto({
    circuits: {
      radiators: withRadiatorsCircuit({}),
      underfloor: {
        deltaTK: 10,
        aggregate: { heatLoadWatts: 8000, flowRateM3PerHour: 0.689 },
        isMixingNodeRequired: false,
        rooms: [],
      },
      dhw: {
        scenario: 'storage',
        peakFlowLps: 0,
        hotWaterPowerKw: 60,
        indirectTank: { volumeLiters: 200, coilPowerKw: 60 },
      },
    },
  });
  const r = resolveCirculationFlows(dto);
  const main = r.zones.find((z) => z.zoneId === 'boiler_primary');
  assert.ok(main);
  assert.ok(main.designFlowM3PerHour > 1.12);
  assert.ok(r.zones.some((z) => z.zoneId === 'dhw_coil'));
  console.log(
    `OK scenario 4 BKN priority: Q_boiler=${main.designFlowM3PerHour} m³/h`,
  );
}

console.log('verify:circulation-flows — все сценарии прошли');
