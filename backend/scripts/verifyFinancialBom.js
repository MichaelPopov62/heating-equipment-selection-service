/**
 * Назначение: verify сборки коммерческой сметы (report.commercial).
 * Описание: схлопывание, ставки 40%/15%, смесительный узел, основная линия котла.
 * Запуск: npm run verify:financial-bom (из backend/)
 */

import assert from 'node:assert/strict';
import {
  buildFinancialBom,
  collapseFinancialBomLines,
  FINANCIAL_LABOR_PERCENT,
  FINANCIAL_CONSUMABLES_PERCENT,
  MIXING_NODE_SELF_ASSEMBLY_NOTE,
} from '../src/report/buildFinancialBom.js';

/**
 * @param {boolean} cond
 * @param {string} msg
 */
function assertOk(cond, msg) {
  assert.equal(cond, true, msg);
}

assert.equal(FINANCIAL_LABOR_PERCENT, 40);
assert.equal(FINANCIAL_CONSUMABLES_PERCENT, 15);
assert.equal(MIXING_NODE_SELF_ASSEMBLY_NOTE, 'сборка самостоятельно');

// --- collapse ---
{
  const collapsed = collapseFinancialBomLines([
    {
      id: 'pipe:a',
      kind: 'equipment',
      objectType: 'house',
      equipmentTypeLabel: 'Труба',
      brand: 'T',
      model: 'PE-Xa 16',
      qty: 100,
      qtyUnit: 'm',
      unitPriceUah: 50,
      lineTotalUah: 5000,
      scopePath: ['Дом', 'Тёплый пол', 'A'],
      categoryId: 'ufh',
      catalogId: 'pipe-a',
      source: 'test',
    },
    {
      id: 'pipe:a',
      kind: 'equipment',
      objectType: 'house',
      equipmentTypeLabel: 'Труба',
      brand: 'T',
      model: 'PE-Xa 16',
      qty: 400,
      qtyUnit: 'm',
      unitPriceUah: 50,
      lineTotalUah: 20000,
      scopePath: ['Дом', 'Тёплый пол', 'B'],
      categoryId: 'ufh',
      catalogId: 'pipe-a',
      source: 'test',
    },
  ]);
  assert.equal(collapsed.length, 1);
  const first = collapsed[0];
  assert.ok(first);
  assert.equal(first.qty, 500);
  assert.equal(first.lineTotalUah, 25000);
  assert.deepEqual(first.scopePath, ['Дом', 'Тёплый пол']);
  console.log('OK: collapse identical pipe lines');
}

// --- full BOM fixture ---
{
  /** @type {import('../src/types/shared-types.js').CalcRequestBody} */
  const input = {
    building: {
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
      temps: { insideC: 20, outsideC: -5 },
      rooms: [
        {
          id: 'r1',
          name: 'Комната 1',
          type: 'гостиная',
          floor: 1,
          topBoundary: 'heated',
          bottomBoundary: 'heated',
          areaM2: 20,
          heightM: 2.7,
        },
        {
          id: 'r2',
          name: 'Комната 2',
          type: 'гостиная',
          floor: 1,
          topBoundary: 'heated',
          bottomBoundary: 'heated',
          areaM2: 15,
          heightM: 2.7,
        },
      ],
      envelopeElements: [],
    },
  };

  /** @type {import('../src/types/shared-types.js').MatchingReport} */
  const matching = {
    boiler: {
      heatLossKw: 10,
      reserveFactor: 1.15,
      hotWaterPowerKw: 5,
      heatingLoadKw: 11.5,
      hotWaterBoilerPowerMatchingScheme:
        'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
      requiredKw: 11.5,
      condensingHeatingReserveFactor: 1.1,
      heatingLoadKwCondensing: 11,
      requiredKwForCondensingLine: 11,
      selected: {
        model: 'Boiler Main',
        powerKw: { min: 3, max: 24 },
        isDoubleCircuit: true,
        circuitsCount: 2,
        type: 'traditional',
        price: 40000,
      },
      warnings: [],
      recommendations: [],
      proposal: {
        kind: 'single',
        headline: 'Одиночный котёл',
        model: 'Boiler Main',
        unitsCount: 1,
        unitMaxPowerKw: 24,
        totalNominalKw: 24,
        requiredKw: 11.5,
        powerRequirementBreakdown: { heatingLoadKw: 11.5, hotWaterPowerKw: 5 },
        nominalReservePercent: 10,
        estimatedTotalPrice: 40000,
        advantages: [],
        notes: [],
      },
      // Эти линии НЕ должны попасть в смету
      proposalEconomy: {
        kind: 'single',
        headline: 'Эконом',
        model: 'Boiler Economy Cheap',
        unitsCount: 1,
        unitMaxPowerKw: 24,
        totalNominalKw: 24,
        requiredKw: 11.5,
        powerRequirementBreakdown: { heatingLoadKw: 11.5, hotWaterPowerKw: 5 },
        nominalReservePercent: 10,
        estimatedTotalPrice: 1000,
        advantages: [],
        notes: [],
      },
      proposalEfficient: {
        kind: 'single',
        headline: 'Эффективный',
        model: 'Boiler Efficient Expensive',
        unitsCount: 1,
        unitMaxPowerKw: 24,
        totalNominalKw: 24,
        requiredKw: 11.5,
        powerRequirementBreakdown: { heatingLoadKw: 11.5, hotWaterPowerKw: 5 },
        nominalReservePercent: 10,
        estimatedTotalPrice: 999999,
        advantages: [],
        notes: [],
      },
    },
    radiators: {
      chosen: null,
      byRoom: [
        {
          roomId: 'r1',
          roomName: 'Комната 1',
          heatLossWatts: 1000,
          radiatorDesignWatts: 1100,
          radiatorModel: 'Rad-A',
          outputPerSectionWatts: 150,
          sections: 10,
          unitsCount: 1,
          displayKind: 'sectional',
          priceBasis: 'section',
          unitPriceUah: 500,
        },
        {
          roomId: 'r2',
          roomName: 'Комната 2',
          heatLossWatts: 800,
          radiatorDesignWatts: 880,
          radiatorModel: 'Rad-A',
          outputPerSectionWatts: 150,
          sections: 10,
          unitsCount: 1,
          displayKind: 'sectional',
          priceBasis: 'section',
          unitPriceUah: 500,
        },
      ],
      warnings: [],
      totalSections: 20,
      lineEconomy: {
        tier: 'economy',
        boilerModel: 'Boiler Economy Cheap',
        chosen: null,
        byRoom: [
          {
            roomId: 'r1',
            roomName: 'Комната 1',
            heatLossWatts: 1000,
            radiatorDesignWatts: 1100,
            radiatorModel: 'Should-Not-Appear',
            outputPerSectionWatts: 100,
            sections: 99,
            unitsCount: 1,
            displayKind: 'sectional',
            priceBasis: 'section',
            unitPriceUah: 1,
          },
        ],
        warnings: [],
        totalSections: 99,
      },
    },
    manifolds: {
      ok: true,
      underfloor: [],
      radiator: null,
      boilerManifold: null,
      warnings: [],
    },
    uniboxes: { byLoop: [], warnings: [] },
    hydraulics: {
      proposal: {
        designFlowM3PerHour: 1,
        headRequiredM: 5,
        pipeLines: [],
        pipeLineGroups: [
          {
            circuitId: 'heating',
            label: 'Контур отопления (радиаторы)',
            pipeLines: [
              {
                catalogPipeId: 'p1',
                brand: 'PipeBrand',
                model: 'Pipe-20',
                material: 'PEX',
                outerDiameterMm: 20,
                wallThicknessMm: 2,
                internalDiameterMm: 16,
                totalLengthM: 50,
                edgeCount: 2,
                pricePerMeter: 40,
                linePrice: 2000,
              },
            ],
            estimatedPrice: 2000,
          },
        ],
        pipeSegments: [],
        pumps: [
          {
            zoneId: 'boiler_primary',
            zoneLabel: 'Циркуляционный насос',
            pumpRole: 'main',
            pumpSource: 'boiler_builtin',
            brand: 'Builtin',
            model: 'Built-in',
            price: 15000,
            modeName: 'III',
            headAtDesignM: 5,
            headRequiredM: 5,
            designFlowM3PerHour: 1,
            headMarginPercent: 10,
          },
          {
            zoneId: 'zone_ufh',
            zoneLabel: 'Насос ТП',
            pumpRole: 'zone',
            pumpSource: 'catalog',
            catalogPumpId: 'pump-1',
            brand: 'PumpBrand',
            model: 'Pump-X',
            price: 8000,
            modeName: 'II',
            headAtDesignM: 4,
            headRequiredM: 3,
            designFlowM3PerHour: 0.5,
            headMarginPercent: 20,
          },
        ],
        estimatedPipesPrice: 2000,
        estimatedPumpPrice: 8000,
        estimatedTotalPrice: 10000,
      },
      warnings: [],
      pipes: [],
    },
  };

  const commercial = buildFinancialBom({
    input,
    matching,
    underfloorHeating: {
      isMixingNodeRequired: true,
    },
  });

  assert.equal(commercial.schemaVersion, 1);
  assert.equal(commercial.currency, 'UAH');
  assert.equal(commercial.rates.laborPercentOfEquipment, 40);
  assert.equal(commercial.rates.consumablesPercentOfEquipment, 15);

  const models = commercial.lines.map((l) => l.model);
  assertOk(!models.includes('Boiler Economy Cheap'), 'economy boiler not in BOM');
  assertOk(!models.includes('Boiler Efficient Expensive'), 'efficient boiler not in BOM');
  assertOk(!models.includes('Should-Not-Appear'), 'economy radiators not in BOM');
  assertOk(models.includes('Boiler Main'), 'main boiler in BOM');
  assertOk(models.includes(MIXING_NODE_SELF_ASSEMBLY_NOTE), 'mixing node note');

  const mixing = commercial.lines.find((l) => l.kind === 'note');
  assertOk(mixing != null, 'mixing note line exists');
  assert.equal(mixing?.lineTotalUah, null);
  assert.equal(mixing?.unitPriceUah, null);

  const rad = commercial.lines.find(
    (l) => l.kind === 'equipment' && l.equipmentTypeLabel === 'Радиатор',
  );
  assertOk(rad != null, 'collapsed radiator line');
  assert.equal(rad?.qty, 2);
  // 500 * 10 сек * 2 прибора
  assert.equal(rad?.lineTotalUah, 10000);

  const builtin = commercial.lines.find((l) => l.model === 'Built-in');
  assert.equal(builtin, undefined, 'builtin pump excluded');

  const pump = commercial.lines.find((l) => l.catalogId === 'pump-1');
  assertOk(pump != null, 'catalog pump included');
  assert.equal(pump?.lineTotalUah, 8000);

  // котёл 40000 + радиаторы 10000 + труба 2000 + насос 8000 = 60000
  assert.equal(commercial.totals.equipmentTotalUah, 60000);
  assert.equal(commercial.totals.laborTotalUah, 24000);
  assert.equal(commercial.totals.consumablesTotalUah, 9000);
  assert.equal(commercial.totals.grandTotalUah, 93000);
  assert.equal(commercial.totals.equipmentQtyPcs, 4); // котёл + 2 рад + насос

  const labor = commercial.lines.find((l) => l.kind === 'labor');
  const consumable = commercial.lines.find((l) => l.kind === 'consumable');
  assertOk(labor != null && consumable != null, 'labor and consumable lines');
  assert.equal(labor?.lineTotalUah, 24000);
  assert.equal(consumable?.lineTotalUah, 9000);

  console.log('OK: buildFinancialBom rates, main line, mixing note, collapse');
}

// --- no equipment → no labor/consumable ---
{
  const commercial = buildFinancialBom({
    input: {
      building: {
        objectMeta: {
          objectType: 'apartment',
          floors: 1,
          roomsCount: 1,
          externalWalls: {
            presetId: 'wall_gas_concrete_d500',
            thicknessMm: 375,
            facadeSystem: 'none',
          },
        },
        temps: { insideC: 20, outsideC: -5 },
        rooms: [],
        envelopeElements: [],
      },
    },
    matching: {},
    underfloorHeating: null,
  });
  assert.equal(commercial.totals.equipmentTotalUah, 0);
  assert.equal(commercial.totals.grandTotalUah, 0);
  assert.equal(
    commercial.lines.filter((l) => l.kind === 'labor' || l.kind === 'consumable')
      .length,
    0,
  );
  console.log('OK: empty matching → no works lines');
}

console.log('verify:financial-bom OK');
