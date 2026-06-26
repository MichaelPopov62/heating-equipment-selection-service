/**
 * Назначение: smoke-тест зоны допустимой рабочей точки насоса.
 * Описание: near_qmax, переразмеренность по напору, геометрия кривой в validateCatalog.
 */

import assert from 'node:assert/strict';
import {
  evaluatePumpModeAtDuty,
  pickPumpForSystem,
} from '../src/hydraulics/pickPump.js';
import { validateAndNormalizeCatalog } from '../src/catalog/validateCatalog.js';

/** @type {import('../src/hydraulics/types').HydraulicsPumpDutyRules} */
const dutyRules = {
  pumpHeadMarginPercent: 12,
  pumpDutyQMaxUtilizationPercent: 85,
  pumpMinHeadAtDutyM: 0.3,
  pumpMaxHeadMarginPercent: 60,
};

/** @type {{ modeName: string; qMinM3h: number; qMaxM3h: number; coefficients: { a: number; b: number; c: number } }} */
const testMode = {
  modeName: 'Тест',
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

// Переразмеренность по напору — отказ
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
