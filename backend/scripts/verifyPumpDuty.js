/**
 * Назначение: smoke-тест зоны допустимой рабочей точки насоса.
 * Описание: near_qmax, переразмеренность по напору, геометрия кривой;
 * гибрид zone: softQMin + skip oversized + exact H_req.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  evaluatePumpModeAtDuty,
  pickPumpForSystem,
} from '../src/hydraulics/pickPump.js';
import { validateAndNormalizeCatalog } from '../src/catalog/validateCatalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('../src/hydraulics/types.js').HydraulicsPumpDutyRules} */
const dutyRules = {
  pumpHeadMarginPercent: 12,
  pumpDutyQMaxUtilizationPercent: 85,
  pumpMinHeadAtDutyM: 0.3,
  pumpMaxHeadMarginPercent: 60,
};

/** @type {import('../src/catalog/types.js').PumpOperatingModeNormalized} */
const testMode = {
  modeName: 'Тест',
  speedIndex: 1,
  powerWatts: 45,
  qMinM3h: 0.2,
  qMaxM3h: 4.0,
  coefficients: { a: -0.15, b: -0.02, c: 5.4 },
};

// Рабочая точка в середине диапазона — OK
{
  const r = evaluatePumpModeAtDuty({
    mode: testMode,
    q: 1.0,
    headRequiredM: 3.5,
    headTarget: 3.92,
    dutyRules,
  });
  assert.equal(r.ok, true);
  assert.ok((r.headAtQ ?? 0) > 3.5);
  console.log('OK duty: середина диапазона Q');
}

// Слишком близко к Q_max (85 %) — отказ
{
  const r = evaluatePumpModeAtDuty({
    mode: testMode,
    q: 3.5,
    headRequiredM: 1,
    headTarget: 1.12,
    dutyRules,
  });
  assert.equal(r.ok, false);
  assert.equal(r.issue, 'near_qmax');
  console.log('OK duty: near_qmax отклонён');
}

// Переразмеренность по напору — отказ (default / main)
{
  const r = evaluatePumpModeAtDuty({
    mode: testMode,
    q: 0.5,
    headRequiredM: 1,
    headTarget: 1.12,
    dutyRules,
  });
  assert.equal(r.ok, false);
  assert.equal(r.issue, 'head_oversized');
  console.log('OK duty: head_oversized отклонён');
}

// Zone: softQMin — Q < qMin допускается
{
  const r = evaluatePumpModeAtDuty({
    mode: testMode,
    q: 0.05,
    headRequiredM: 3,
    headTarget: 3,
    dutyRules,
    softQMin: true,
    skipHeadOversizedCheck: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.softQMinApplied, true);
  console.log('OK duty zone: softQMin при Q < qMin');
}

// Zone: без softQMin — hard-fail
{
  const r = evaluatePumpModeAtDuty({
    mode: testMode,
    q: 0.05,
    headRequiredM: 3,
    headTarget: 3,
    dutyRules,
  });
  assert.equal(r.ok, false);
  assert.equal(r.issue, 'below_manufacturer_qmin');
  console.log('OK duty: Q < qMin без soft — отказ');
}

// pickPumpForSystem не выбирает режим у правого края
{
  const { pump } = pickPumpForSystem({
    designFlowM3PerHour: 3.5,
    headRequiredM: 1,
    dutyRules,
    pumps: [{
      id: 'pump-test',
      brand: 'Test',
      model: 'Test',
      type: 'electronic',
      segment: 'budget',
      price: 1000,
      connections: {
        mountingLengthMm: 180,
        threadInch: '1 1/2',
        nominalDiameterMm: 25,
      },
      operatingModes: [testMode],
    }],
  });
  assert.equal(pump, null);
  console.log('OK pickPump: нет насоса при Q у правого края');
}

// Zone hybrid: микро-Q + H_req=3 (exact) → подбор из seed-каталога
{
  const catalogPath = path.join(__dirname, '../test_data.json');
  const raw = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const cat = validateAndNormalizeCatalog(raw);

  const picked = pickPumpForSystem({
    designFlowM3PerHour: 0.068,
    headRequiredM: 3,
    pumps: cat.pumps,
    dutyRules,
    softQMin: true,
    skipHeadOversizedCheck: true,
    useExactHeadRequired: true,
  });
  assert.ok(picked.pump, 'ожидался зональный насос при Q=0.068 H=3');
  assert.ok(
    picked.pump.headAtDesignM >= 3,
    `H(Q)=${picked.pump.headAtDesignM} < 3`,
  );
  console.log(
    `OK pickPump zone: Q=0.068 H=3 → ${picked.pump.catalogPumpId} `
    + `(${picked.pump.modeName}), H=${picked.pump.headAtDesignM}`,
  );

  // Q ниже всех qMin каталога → softQMin warning обязателен
  const soft = pickPumpForSystem({
    designFlowM3PerHour: 0.03,
    headRequiredM: 3,
    pumps: cat.pumps,
    dutyRules,
    softQMin: true,
    skipHeadOversizedCheck: true,
    useExactHeadRequired: true,
  });
  assert.ok(soft.pump, 'ожидался насос при Q=0.03 с softQMin');
  assert.ok(
    soft.warnings.some((w) => w.includes('левого края') || w.includes('q_min')),
    `ожидался warning softQMin, got: ${soft.warnings.join(' | ')}`,
  );
  console.log(
    `OK pickPump zone softQMin: Q=0.03 → ${soft.pump.catalogPumpId}, warnings=${soft.warnings.length}`,
  );

  // Без гибрида (как main) — микро-Q не подбирается
  const strict = pickPumpForSystem({
    designFlowM3PerHour: 0.068,
    headRequiredM: 3,
    pumps: cat.pumps,
    dutyRules,
  });
  assert.equal(strict.pump, null, 'без zone-флагов микро-Q не должен проходить');
  console.log('OK pickPump main-style: Q=0.068 H=3 → null');
}

// Zone: oversized не режет; среди прошедших — минимальный запас
{
  const tight = {
    id: 'pump-tight',
    brand: 'T',
    model: 'Tight',
    type: 'electronic',
    segment: 'budget',
    price: 1000,
    connections: {
      mountingLengthMm: 180,
      threadInch: '1',
      nominalDiameterMm: 25,
    },
    operatingModes: [{
      modeName: 'Tight',
      speedIndex: 1,
      powerWatts: 40,
      qMinM3h: 0.1,
      qMaxM3h: 3,
      coefficients: { a: -0.05, b: -0.05, c: 3.4 },
    }],
  };
  const oversized = {
    id: 'pump-big',
    brand: 'B',
    model: 'Big',
    type: 'electronic',
    segment: 'premium',
    price: 5000,
    connections: {
      mountingLengthMm: 180,
      threadInch: '1',
      nominalDiameterMm: 25,
    },
    operatingModes: [{
      modeName: 'Big',
      speedIndex: 1,
      powerWatts: 80,
      qMinM3h: 0.1,
      qMaxM3h: 4,
      coefficients: { a: -0.05, b: -0.05, c: 8 },
    }],
  };
  const { pump } = pickPumpForSystem({
    designFlowM3PerHour: 0.5,
    headRequiredM: 3,
    pumps: [oversized, tight],
    dutyRules,
    softQMin: true,
    skipHeadOversizedCheck: true,
    useExactHeadRequired: true,
  });
  assert.equal(pump?.catalogPumpId, 'pump-tight');
  console.log('OK pickPump zone: выбор минимального запаса при skip oversized');
}

// validateCatalog: кривая с H(qMax)<0.5 — ошибка
{
  let threw = false;
  try {
    validateAndNormalizeCatalog({
      products: { boilers: { doubleCircuit: [], singleCircuit: [] }, radiators: [], waterHeaters: [], pipes: [] },
      pumps: [{
        id: 'bad-pump',
        brand: 'Bad',
        model: 'Bad',
        type: 'three_speed',
        segment: 'budget',
        price: 100,
        connections: {
          mountingLengthMm: 180,
          threadInch: '1',
          nominalDiameterMm: 25,
        },
        operatingModes: [{
          modeName: 'Плохой',
          speedIndex: 1,
          powerWatts: 30,
          coefficients: { a: -2, b: 0, c: 0.2 },
          qMinM3h: 0.1,
          qMaxM3h: 2,
        }],
      }],
    });
  } catch (err) {
    threw = true;
    assert.match(String(err instanceof Error ? err.message : err), /H\(qMin\)|H\(qMax\)|нет Q/);
  }
  assert.equal(threw, true);
  console.log('OK validateCatalog: некорректная кривая отклонена');
}

console.log('verify:pump-duty — все сценарии прошли');
