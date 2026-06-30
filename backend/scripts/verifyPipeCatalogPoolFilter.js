/**
 * Назначение: verify guard минимального внутреннего диаметра (pipeCatalogPoolFilter).
 * Запуск: npm run verify:pipe-catalog-pool-filter (из backend/)
 */

import { getReferenceBundle } from '../src/reference/public.js';
import {
  filterPoolByMinInternalDiameter,
  resolveMinInternalDiameterMm,
} from '../src/hydraulics/pipeCatalogPoolFilter.js';
import { pipeInternalDiameterMm } from '../src/hydraulics/pipeHydraulics.js';
import { hydraulicsRulesFromAppliance } from '../src/hydraulics/resolveEmittersMode.js';

const bundle = await getReferenceBundle();
const pipes = [...(bundle.catalog.pipes ?? [])].sort(
  (a, b) => pipeInternalDiameterMm(a) - pipeInternalDiameterMm(b),
);
const rules = hydraulicsRulesFromAppliance(bundle.appliances.byKind.hydraulics);

const mainEdge = {
  id: 'e_boiler_main',
  from: 'boiler',
  to: 'main_collector',
  lengthM: 10,
  fluid: 'heating',
  designFlowM3PerHour: 0.075,
  segmentRole: 'main',
  isMainLine: true,
};

const branchEdge = {
  id: 'e_test_branch',
  from: 'main_collector',
  to: 'rad_r1',
  lengthM: 4,
  fluid: 'heating',
  designFlowM3PerHour: 0.004,
  segmentRole: 'branch',
};

const ufhLoopEdge = {
  id: 'r1_loop_1',
  from: 'ufh_collector',
  to: 'r1_loop_1',
  lengthM: 50,
  fluid: 'heating',
  designFlowM3PerHour: 0.02,
  segmentRole: 'ufh_loop',
};

const mainMin = resolveMinInternalDiameterMm(mainEdge, rules);
const branchMin = resolveMinInternalDiameterMm(branchEdge, rules);
const ufhLoopMin = resolveMinInternalDiameterMm(ufhLoopEdge, rules);

if (mainMin !== 20) {
  throw new Error(`mainMin: ожидалось 20, получено ${mainMin}`);
}
if (branchMin !== 12) {
  throw new Error(`branchMin: ожидалось 12, получено ${branchMin}`);
}
if (ufhLoopMin !== 0) {
  throw new Error(`ufhLoopMin: петли ТП без guard Dвн, ожидалось 0, получено ${ufhLoopMin}`);
}

const mainPool = filterPoolByMinInternalDiameter(pipes, mainMin);
if (mainPool.exhausted || mainPool.pool.length === 0) {
  throw new Error('mainPool: пул не должен быть пустым');
}
for (const p of mainPool.pool) {
  if (pipeInternalDiameterMm(p) < 20) {
    throw new Error(`mainPool: ${p.id} Dвн ${pipeInternalDiameterMm(p)} < 20`);
  }
}

const branchPool = filterPoolByMinInternalDiameter(pipes, branchMin);
if (branchPool.exhausted) {
  throw new Error('branchPool: пул не должен быть пустым');
}
const smallestBranch = branchPool.pool[0];
if (pipeInternalDiameterMm(smallestBranch) < 12) {
  throw new Error(
    `branchPool: min ${smallestBranch.id} Dвн ${pipeInternalDiameterMm(smallestBranch)} < 12`,
  );
}

const emptyPool = filterPoolByMinInternalDiameter(pipes, 999);
if (!emptyPool.exhausted) {
  throw new Error('emptyPool: ожидался exhausted при Dвн ≥ 999');
}

console.log('verify:pipe-catalog-pool-filter — все кейсы прошли');
