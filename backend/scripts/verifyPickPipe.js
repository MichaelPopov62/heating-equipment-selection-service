/**
 * Назначение: verify логики pickPipe (fallback min/max Ø).
 * Запуск: npm run verify:pick-pipe (из backend/)
 */

import { getReferenceBundle } from '../src/reference/public.js';
import { pickPipeForEdge } from '../src/hydraulics/pickPipe.js';
import { hydraulicsRulesFromAppliance } from '../src/hydraulics/resolveEmittersMode.js';

const bundle = await getReferenceBundle();
const pipes = bundle.catalog.pipes ?? [];
const rules = hydraulicsRulesFromAppliance(bundle.appliances.byKind.hydraulics);

/**
 * @param {string} label
 * @param {number} flowM3PerHour
 * @param {(match: import('../src/hydraulics/types').HydraulicsPipeMatchItem) => void} assertFn
 * @param {{ rules?: import('../src/hydraulics/types').HydraulicsRules }} [options]
 */
function runCase(label, flowM3PerHour, assertFn, options = {}) {
  const match = pickPipeForEdge({
    edge: {
      id: `e_test_${label}`,
      from: 'boiler',
      to: 'rad_test',
      lengthM: 4,
      fluid: 'heating',
      designFlowM3PerHour: flowM3PerHour,
      segmentRole: 'branch',
    },
    pipes,
    rules: options.rules ?? rules,
  });
  if (!match) {
    throw new Error(`${label}: pickPipeForEdge вернул null`);
  }
  assertFn(match);
  console.log(
    `OK ${label}: Ø ${match.catalogPipeId}, v=${match.velocityMps} м/с`
    + `${match.velocityLimitExceeded ? ', exceeded' : ''}`
    + `${match.velocityBelowMin ? ', belowMin' : ''}`,
  );
}

const sorted = [...pipes].sort(
  (a, b) => (a.diameter - 2 * a.wallThickness) - (b.diameter - 2 * b.wallThickness),
);
const minPipe = sorted[0];
const maxPipe = sorted[sorted.length - 1];

runCase('micro_flow', 0.004, (m) => {
  if (m.catalogPipeId !== minPipe.id) {
    throw new Error(`micro_flow: ожидался min Ø ${minPipe.id}, получен ${m.catalogPipeId}`);
  }
  if (m.catalogPipeId === maxPipe.id) {
    throw new Error('micro_flow: не должен подбираться max Ø каталога');
  }
  if (m.velocityLimitExceeded) {
    throw new Error('micro_flow: не ожидается velocityLimitExceeded');
  }
});

runCase('normal_flow', 0.15, (m) => {
  if (m.velocityLimitExceeded) {
    throw new Error('normal_flow: не ожидается velocityLimitExceeded');
  }
  if (m.velocityMps > rules.velocityLimitsMps.branchMax) {
    throw new Error(
      `normal_flow: v=${m.velocityMps} > branchMax=${rules.velocityLimitsMps.branchMax}`,
    );
  }
});

runCase('high_flow', 5.0, (m) => {
  if (!m.velocityLimitExceeded) {
    throw new Error('high_flow: ожидался velocityLimitExceeded');
  }
  if (m.catalogPipeId !== maxPipe.id) {
    throw new Error(`high_flow: ожидался max Ø ${maxPipe.id}, получен ${m.catalogPipeId}`);
  }
});

runCase('micro_flow_with_vmin', 0.004, (m) => {
  if (!m.velocityBelowMin) {
    throw new Error('micro_flow_with_vmin: ожидался velocityBelowMin при branchMin=0.05');
  }
}, {
  rules: {
    ...rules,
    velocityLimitsMps: { ...rules.velocityLimitsMps, branchMin: 0.05 },
  },
});

console.log('verify:pick-pipe — все кейсы прошли');
