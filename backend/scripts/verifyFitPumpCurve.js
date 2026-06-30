/**
 * Назначение: проверка аппроксимации кривых Baxi H(Q) по трём точкам.
 * Описание: 6 режимов circulationPump — коэффициенты и контрольные точки паспорта.
 */

import assert from 'node:assert/strict';
import {
  fitPumpCurveFromThreePoints,
  pumpHeadM,
} from '../src/utils/pumpCurveMath.js';

/** @type {Array<{ label: string; q: [number, number, number]; h: [number, number, number]; expect: { a: number; b: number; c: number }; checks: Array<{ q: number; h: number }> }>} */
const BAXI_MODES = [
  {
    label: 'ECO Home S1',
    q: [0, 0.4, 0.6],
    h: [2.0, 1.8, 1.5],
    expect: { a: -1.667, b: 0.167, c: 2.0 },
    checks: [{ q: 0.4, h: 1.8 }, { q: 0.6, h: 1.5 }],
  },
  {
    label: 'ECO Home S2',
    q: [0, 0.4, 0.6],
    h: [3.5, 3.1, 2.8],
    expect: { a: -0.833, b: -0.667, c: 3.5 },
    checks: [{ q: 0.6, h: 2.8 }],
  },
  {
    label: 'ECO Home S3',
    q: [0, 1.0, 1.4],
    h: [4.0, 2.0, 0.4],
    expect: { a: -1.429, b: -0.571, c: 4.0 },
    checks: [{ q: 1.0, h: 2.0 }, { q: 1.4, h: 0.4 }],
  },
  {
    label: 'Luna 33 S1 (20%)',
    q: [0, 0.4, 0.6],
    h: [1.3, 1.1, 0.8],
    expect: { a: -1.667, b: 0.167, c: 1.3 },
    checks: [{ q: 0.5, h: 0.97 }],
  },
  {
    label: 'Luna 33 S2 (40%)',
    q: [0, 0.4, 0.6],
    h: [2.6, 2.2, 1.9],
    expect: { a: -0.833, b: -0.667, c: 2.6 },
    checks: [{ q: 0.6, h: 1.9 }],
  },
  {
    label: 'Luna 33 S3 (100%)',
    q: [0, 1.0, 2.0],
    h: [6.5, 4.5, 0.8],
    expect: { a: -0.85, b: -1.15, c: 6.5 },
    checks: [{ q: 1.0, h: 4.5 }, { q: 2.0, h: 0.8 }],
  },
];

for (const mode of BAXI_MODES) {
  const coef = fitPumpCurveFromThreePoints(mode.q, mode.h);
  assert.equal(coef.a, mode.expect.a, `${mode.label}: a`);
  assert.equal(coef.b, mode.expect.b, `${mode.label}: b`);
  assert.equal(coef.c, mode.expect.c, `${mode.label}: c`);

  for (const check of mode.checks) {
    const h = pumpHeadM(coef, check.q);
    assert.ok(
      Math.abs(h - check.h) < 0.05,
      `${mode.label}: H(${check.q})=${h}, ожидалось ≈${check.h}`,
    );
  }
  console.log(`OK fit: ${mode.label}`);
}

console.log('OK verifyFitPumpCurve: все 6 режимов Baxi');
