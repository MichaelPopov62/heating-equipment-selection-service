/**
 * Назначение: smoke-тест гидравлики петель ТП.
 * Описание: validateUfhLoopHydraulics + resolveUfhRoomLoopsHydraulics на фикстурах.
 */

import { getReferenceBundle } from '../src/reference/public.js';
import { toCalcRuntimeContext } from '../src/reference/toCalcRuntimeContext.js';
import {
  estimateUfhLoopElbowCount,
  resolveUfhRoomLoopsHydraulics,
  validateUfhLoopHydraulics,
} from '../src/logic/ufhLoopHydraulics.js';

const bundle = await getReferenceBundle();
const ctx = toCalcRuntimeContext(bundle);
const rules = ctx.appliances.byKind.hydraulics;
const pipes = ctx.catalog.pipes ?? [];

if (!pipes.length) {
  throw new Error('Каталог pipes пуст');
}

const elbow85 = estimateUfhLoopElbowCount(85, 150);
if (elbow85 < 2) {
  throw new Error(`elbowCount для 85 м / 150 мм: ожидалось ≥ 2, получено ${elbow85}`);
}

const single = validateUfhLoopHydraulics({
  loopId: 'test_loop_1',
  lengthM: 85,
  pipeSpacingMm: 150,
  heatLoadWatts: 1500,
  deltaTK: rules.ufhLoopDeltaTK,
  pipes,
  hydraulicsRules: rules,
});

if (single.flowRateM3PerHour <= 0) {
  throw new Error('flowRateM3PerHour должен быть > 0');
}
if (single.catalogPipeId == null || single.velocityMps == null || single.pressureDropKPa == null) {
  throw new Error('Подбор трубы для петли 85 м не выполнен');
}
console.log(
  `OK single loop 85m: Q=${single.flowRateM3PerHour} m³/h, v=${single.velocityMps} m/s, Δp=${single.pressureDropKPa} kPa, pipe=${single.catalogPipeId}, elbows=${single.elbowCount}`,
);

const room = resolveUfhRoomLoopsHydraulics({
  areaM2: 20,
  pipeSpacingMm: 150,
  heatLoadWatts: 3000,
  roomId: 'r_ufh',
  pipes,
  hydraulicsRules: rules,
});

if (!room.loops.length) {
  throw new Error('resolveUfhRoomLoopsHydraulics: пустой массив loops');
}
for (const h of room.loopHydraulics) {
  if (h.pressureDropKPa != null && h.pressureDropKPa > rules.maxUfhLoopPressureDropKPa) {
    throw new Error(
      `Петля ${h.loopId}: Δp ${h.pressureDropKPa} > ${rules.maxUfhLoopPressureDropKPa} kPa после resolve`,
    );
  }
}

console.log(
  `OK room 20m²: loops=${room.loopsCount}, L1=${room.loops[0].estimatedLengthM} m, Δp=${room.loopHydraulics[0].pressureDropKPa} kPa`,
);
console.log('verify:ufh-loop-hydraulics — все проверки прошли');
