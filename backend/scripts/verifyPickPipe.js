/**
 * Назначение: verify логики pickPipe (guard Dвн + fallback min/max Ø).
 * Запуск: npm run verify:pick-pipe (из backend/)
 */

import { getReferenceBundle } from '../src/reference/public.js';
import { pickPipeForEdge } from '../src/hydraulics/pickPipe.js';
import {
  pickTrunkChainWithTaper,
} from '../src/hydraulics/pickTrunkChain.js';
import { pipeInternalDiameterMm } from '../src/hydraulics/pipeHydraulics.js';
import { hydraulicsRulesFromAppliance } from '../src/hydraulics/resolveEmittersMode.js';

const bundle = await getReferenceBundle();
const pipes = bundle.catalog.pipes ?? [];
const rules = hydraulicsRulesFromAppliance(bundle.appliances.byKind.hydraulics);

/**
 * @param {string} label
 * @param {import('../src/hydraulics/types').HydraulicsGraphEdge} edge
 * @param {number} flowM3PerHour
 * @param {(match: import('../src/hydraulics/types').HydraulicsPipeMatchItem) => void} assertFn
 * @param {{ rules?: import('../src/hydraulics/types').HydraulicsRules }} [options]
 */
function runCase(label, edge, flowM3PerHour, assertFn, options = {}) {
  const match = pickPipeForEdge({
    edge: { ...edge, designFlowM3PerHour: flowM3PerHour },
    pipes,
    rules: options.rules ?? rules,
  });
  if (!match) {
    throw new Error(`${label}: pickPipeForEdge вернул null`);
  }
  assertFn(match);
  console.log(
    `OK ${label}: Ø ${match.catalogPipeId || '(exhausted)'}, v=${match.velocityMps} м/с`
    + `${match.velocityLimitExceeded ? ', exceeded' : ''}`
    + `${match.velocityBelowMin ? ', belowMin' : ''}`
    + `${match.mainTransitGuardApplied ? ', mainGuard' : ''}`
    + `${match.catalogPoolExhausted ? ', exhausted' : ''}`,
  );
}

const sorted = [...pipes].sort(
  (a, b) => pipeInternalDiameterMm(a) - pipeInternalDiameterMm(b),
);
const minPipeOverall = sorted[0];
const minBranchPipe = sorted.find((p) => pipeInternalDiameterMm(p) >= 12) ?? sorted[0];
const minMainTransitPipe = sorted.find((p) => pipeInternalDiameterMm(p) >= 20);
const maxPipe = sorted[sorted.length - 1];

const branchEdge = {
  id: 'e_test_branch',
  from: 'boiler',
  to: 'rad_test',
  lengthM: 4,
  fluid: 'heating',
  designFlowM3PerHour: 0,
  segmentRole: 'branch',
};

const mainTransitEdge = {
  id: 'e_boiler_main',
  from: 'boiler',
  to: 'main_collector',
  lengthM: 10,
  fluid: 'heating',
  designFlowM3PerHour: 0,
  segmentRole: 'main',
  isMainLine: true,
};

runCase('branch_micro_flow', branchEdge, 0.004, (m) => {
  if (m.catalogPipeId === minPipeOverall.id && pipeInternalDiameterMm(minPipeOverall) < 12) {
    throw new Error('branch_micro_flow: p-01 (Dвн < 12) не должен подбираться');
  }
  if (m.catalogPipeId !== minBranchPipe.id) {
    throw new Error(
      `branch_micro_flow: ожидался min Ø ${minBranchPipe.id}, получен ${m.catalogPipeId}`,
    );
  }
  if (m.catalogPipeId === maxPipe.id) {
    throw new Error('branch_micro_flow: не должен подбираться max Ø каталога');
  }
});

runCase('branch_normal_flow', branchEdge, 0.15, (m) => {
  if (m.velocityLimitExceeded) {
    throw new Error('branch_normal_flow: не ожидается velocityLimitExceeded');
  }
  if (m.velocityMps > rules.velocityLimitsMps.branchMax) {
    throw new Error(
      `branch_normal_flow: v=${m.velocityMps} > branchMax=${rules.velocityLimitsMps.branchMax}`,
    );
  }
  if (m.internalDiameterMm < 12) {
    throw new Error(`branch_normal_flow: Dвн ${m.internalDiameterMm} < 12`);
  }
});

runCase('branch_high_flow', branchEdge, 5.0, (m) => {
  if (!m.velocityLimitExceeded) {
    throw new Error('branch_high_flow: ожидался velocityLimitExceeded');
  }
  if (m.catalogPipeId !== maxPipe.id) {
    throw new Error(`branch_high_flow: ожидался max Ø ${maxPipe.id}, получен ${m.catalogPipeId}`);
  }
});

runCase('branch_micro_flow_with_vmin', branchEdge, 0.004, (m) => {
  if (!m.velocityBelowMin) {
    throw new Error('branch_micro_flow_with_vmin: ожидался velocityBelowMin при branchMin=0.05');
  }
}, {
  rules: {
    ...rules,
    velocityLimitsMps: { ...rules.velocityLimitsMps, branchMin: 0.05 },
  },
});

if (!minMainTransitPipe) {
  throw new Error('Каталог: нет трубы с Dвн ≥ 20 для тестов транзита');
}

runCase('main_transit_micro_Q', mainTransitEdge, 0.075, (m) => {
  if (!m.mainTransitGuardApplied) {
    throw new Error('main_transit_micro_Q: ожидался mainTransitGuardApplied');
  }
  if (m.internalDiameterMm < 20) {
    throw new Error(`main_transit_micro_Q: Dвн ${m.internalDiameterMm} < 20`);
  }
  if (m.catalogPipeId === 'p-01') {
    throw new Error('main_transit_micro_Q: p-01 (Ø16) недопустим на транзите');
  }
  if (!m.velocityBelowMin) {
    throw new Error('main_transit_micro_Q: ожидался velocityBelowMin при микропотоке');
  }
});

runCase('main_transit_normal_Q', mainTransitEdge, 0.2, (m) => {
  if (m.internalDiameterMm < 20) {
    throw new Error(`main_transit_normal_Q: Dвн ${m.internalDiameterMm} < 20`);
  }
  if (m.velocityMps > rules.velocityLimitsMps.mainMax) {
    throw new Error('main_transit_normal_Q: v выше mainMax');
  }
});

const trunkEdgeHigh = {
  id: 'e_trunk_high',
  from: 'rad_trunk_j_0',
  to: 'rad_trunk_j_1',
  lengthM: 3,
  fluid: 'heating',
  designFlowM3PerHour: 0,
  segmentRole: 'trunk',
  teeRole: 'pass_through',
};

const trunkEdgeLow = {
  id: 'e_trunk_low',
  from: 'rad_trunk_j_1',
  to: 'rad_trunk_j_2',
  lengthM: 3,
  fluid: 'heating',
  designFlowM3PerHour: 0,
  segmentRole: 'trunk',
  teeRole: 'pass_through',
};

runCase('trunk_high_flow', trunkEdgeHigh, 0.12, (m) => {
  if (m.internalDiameterMm < 12) {
    throw new Error(`trunk_high_flow: Dвн ${m.internalDiameterMm} < 12`);
  }
});

runCase('trunk_low_flow', trunkEdgeLow, 0.03, (m) => {
  if (m.internalDiameterMm < 12) {
    throw new Error(`trunk_low_flow: Dвн ${m.internalDiameterMm} < 12`);
  }
});

const highMatch = pickPipeForEdge({
  edge: { ...trunkEdgeHigh, designFlowM3PerHour: 0.12 },
  pipes,
  rules,
});
const lowMatch = pickPipeForEdge({
  edge: { ...trunkEdgeLow, designFlowM3PerHour: 0.03 },
  pipes,
  rules,
});
if (highMatch && lowMatch && lowMatch.internalDiameterMm > highMatch.internalDiameterMm) {
  throw new Error(
    `trunk_monotonic_isolated: Ø low ${lowMatch.internalDiameterMm} > Ø high ${highMatch.internalDiameterMm}`,
  );
}
console.log('OK trunk_monotonic_isolated: Ø high ≥ Ø low при убывающем Q (без цепочки)');

const taperMatches = pickTrunkChainWithTaper({
  chain: [
    { ...trunkEdgeHigh, designFlowM3PerHour: 0.12 },
    { ...trunkEdgeLow, designFlowM3PerHour: 0.03 },
  ],
  pipes,
  rules,
  resolveLocalZeta: () => 0.6,
  filterMaterialPool: (catalogPipes) =>
    [...catalogPipes].sort(
      (a, b) => pipeInternalDiameterMm(a) - pipeInternalDiameterMm(b),
    ),
});
const taperHigh = taperMatches.get('e_trunk_high');
const taperLow = taperMatches.get('e_trunk_low');
if (!taperHigh || !taperLow) {
  throw new Error('trunk_taper_chain: нет подбора для цепочки');
}
if (taperLow.internalDiameterMm > taperHigh.internalDiameterMm) {
  throw new Error(
    `trunk_taper_chain: downstream Ø ${taperLow.internalDiameterMm} `
    + `> upstream Ø ${taperHigh.internalDiameterMm}`,
  );
}
if (taperHigh.velocityMps > rules.velocityLimitsMps.mainMax) {
  throw new Error(`trunk_taper_chain: upstream v=${taperHigh.velocityMps} > mainMax`);
}
console.log(
  `OK trunk_taper_chain: Ø upstream ${taperHigh.internalDiameterMm} `
  + `≥ downstream ${taperLow.internalDiameterMm}, v=${taperHigh.velocityMps} м/с`,
);

console.log('verify:pick-pipe — все кейсы прошли');
