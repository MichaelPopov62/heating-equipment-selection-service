/**
 * Назначение: smoke-тест resolveFlowDeltaTK (SSOT ΔT для расхода).
 */

import assert from 'node:assert/strict';
import { resolveFlowDeltaTK } from '../src/hydraulics/resolveFlowDeltaTK.js';

assert.equal(
  resolveFlowDeltaTK({ deltaTSystemK: 20, supplyC: 75, returnC: 65 }),
  20,
  'анкета deltaTSystemK имеет приоритет над графиком 75/65',
);

assert.equal(
  resolveFlowDeltaTK({ deltaTSystemK: undefined, supplyC: 75, returnC: 65 }),
  10,
  'fallback — supplyC−returnC',
);

assert.equal(
  resolveFlowDeltaTK({ deltaTSystemK: 0, supplyC: 55, returnC: 45 }),
  10,
  'невалидный deltaTSystemK → fallback',
);

assert.equal(
  resolveFlowDeltaTK({ deltaTSystemK: undefined, supplyC: 75, returnC: 75 }),
  0.1,
  'нулевой перепад графика → min 0.1 K',
);

console.log('verify:flow-delta-tk — OK');
