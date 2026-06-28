/**
 * Назначение: smoke-тест гидравлики петель ТП.
 * Описание: validateUfhLoopHydraulics + resolveUfhRoomLoopsHydraulics на фикстурах.
 */

import { getReferenceBundle } from '../src/reference/public.js';
import { toCalcRuntimeContext } from '../src/reference/toCalcRuntimeContext.js';
import {
  estimateUfhLoopElbowCount,
  resolveUfhRoomLoopsHydraulics,
  shouldTriggerUfhPipeResize,
  validateUfhLoopHydraulics,
} from '../src/logic/ufhLoopHydraulics.js';

const bundle = await getReferenceBundle();
const ctx = toCalcRuntimeContext(bundle);
const rules = ctx.appliances.byKind.hydraulics;
const pipes = ctx.catalog.pipes ?? [];

if (!pipes.length) {
  throw new Error('Каталог pipes пуст');
}

if (rules.ufhLoopMinNominalDiameterMm !== 16) {
  throw new Error(`ufhLoopMinNominalDiameterMm: ожидалось 16, получено ${rules.ufhLoopMinNominalDiameterMm}`);
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
if (room.resolutionStatus !== 'resolved_auto') {
  throw new Error(`room 20m²: ожидался resolved_auto, получено ${room.resolutionStatus}`);
}
for (const h of room.loopHydraulics) {
  if (h.pressureDropKPa != null && h.pressureDropKPa > rules.maxUfhLoopPressureDropKPa) {
    throw new Error(
      `Петля ${h.loopId}: Δp ${h.pressureDropKPa} > ${rules.maxUfhLoopPressureDropKPa} kPa после resolve`,
    );
  }
  if (
    h.velocityMps != null
    && (h.velocityMps < rules.ufhLoopVelocityMinMps || h.velocityMps > rules.ufhLoopVelocityMaxMps)
  ) {
    throw new Error(
      `Петля ${h.loopId}: v=${h.velocityMps} вне [${rules.ufhLoopVelocityMinMps}, ${rules.ufhLoopVelocityMaxMps}]`,
    );
  }
}

console.log(
  `OK room 20m²: loops=${room.loopsCount}, status=${room.resolutionStatus}, L1=${room.loops[0].estimatedLengthM} m, Δp=${room.loopHydraulics[0].pressureDropKPa} kPa`,
);

const parasitic = shouldTriggerUfhPipeResize({
  heatFluxDownWm2: 8,
  heatFluxDownWatts: 400,
  heatFluxUpWatts: 2000,
  bottomBoundary: 'heated',
  hydraulicsRules: rules,
});
if (!parasitic) {
  throw new Error('shouldTriggerUfhPipeResize: ожидался true при q↓=8 Вт/м² и heated');
}

const parasiticRoom = resolveUfhRoomLoopsHydraulics({
  areaM2: 24,
  pipeSpacingMm: 150,
  heatLoadWatts: 2800,
  heatFluxDownWm2: 12,
  heatFluxDownWatts: 320,
  heatFluxUpWatts: 2800,
  bottomBoundary: 'heated',
  roomId: 'r_parasitic',
  pipes,
  hydraulicsRules: rules,
});
if (!parasiticRoom.loops.length) {
  throw new Error('parasitic room: пустой массив loops');
}
const h0 = parasiticRoom.loopHydraulics[0];
console.log(
  `OK parasitic 24m² heated: loops=${parasiticRoom.loopsCount}, status=${parasiticRoom.resolutionStatus}, `
  + `v=${h0.velocityMps} m/s, resize=${h0.pipeResizeAction}, pipe=${h0.catalogPipeId}`,
);

/** Комната с геом. 2 петли — автооптимизация без q↓ тоже должна искать v+Δp. */
const wideRoom = resolveUfhRoomLoopsHydraulics({
  areaM2: 30,
  pipeSpacingMm: 150,
  heatLoadWatts: 4500,
  roomId: 'r_wide',
  pipes,
  hydraulicsRules: rules,
});
if (wideRoom.minLoopsGeom < 2) {
  throw new Error('r_wide: ожидалось minLoopsGeom ≥ 2');
}
console.log(
  `OK wide 30m²: minGeom=${wideRoom.minLoopsGeom}, chosen=${wideRoom.chosenLoopsCount}, status=${wideRoom.resolutionStatus}`,
);

console.log('verify:ufh-loop-hydraulics — все проверки прошли');
