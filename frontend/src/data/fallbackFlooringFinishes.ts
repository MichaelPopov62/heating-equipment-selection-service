/**
 * Назначение: Офлайн-справочник финишных покрытий ТП.
 */

import type { FlooringFinishMaterial } from '../types/underfloorHeating';

export const DEFAULT_FLOORING_FINISH_ID = 'pvc_glue';

export const FALLBACK_FLOORING_FINISH_MATERIALS: FlooringFinishMaterial[] = [
  {
    id: 'ceramic_tile',
    name: 'Керамічна плитка / керамограніт (+ клей)',
    thicknessM: 0.012,
    thermalConductivityWmK: 1.05,
    maxSurfaceTemperatureCelsius: 35,
    comfortMaxSurfaceTemperatureCelsius: 29,
    defaultUfhCircuitPresetId: 'ufh_dt10_45_35',
  },
  {
    id: 'pvc_glue',
    name: 'Клейовий кварцвініл / LVT плитка',
    thicknessM: 0.003,
    thermalConductivityWmK: 0.2,
    maxSurfaceTemperatureCelsius: 27,
    defaultUfhCircuitPresetId: 'ufh_dt10_40_30',
  },
  {
    id: 'pvc_click',
    name: 'Замковий кварцвініл SPC/LVT (разом із підкладкою)',
    thicknessM: 0.0065,
    thermalConductivityWmK: 0.14,
    maxSurfaceTemperatureCelsius: 27,
    defaultUfhCircuitPresetId: 'ufh_dt10_40_30',
  },
  {
    id: 'laminate_click',
    name: 'Ламінат замковий (разом із підкладкою ТП)',
    thicknessM: 0.01,
    thermalConductivityWmK: 0.1,
    maxSurfaceTemperatureCelsius: 27,
    defaultUfhCircuitPresetId: 'ufh_dt10_40_30',
  },
];
