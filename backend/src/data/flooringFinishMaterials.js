/**
 * Назначение: справочник финишных покрытий для расчёта ТП.
 * Описание: Отдельно от базового конструктива (warmFloorAssemblyPresets). Rλ,B финиша = δ/λ;
 * лимит температуры поверхности задаётся материалом (27 °C винил/ламинат, до 35 °C керамика).
 */

/** @typedef {import('../types/shared-types').FlooringFinishMaterial} FlooringFinishMaterial */

/** @type {FlooringFinishMaterial[]} */
export const FLOORING_FINISH_MATERIALS = [
  {
    id: 'ceramic_tile',
    name: 'Керамічна плитка / керамограніт (+ клей)',
    thicknessM: 0.012,
    thermalConductivityWmK: 1.05,
    maxSurfaceTemperatureCelsius: 35,
    comfortMaxSurfaceTemperatureCelsius: 29,
    defaultUfhCircuitPresetId: 'ufh_dt10_45_35',
    notes:
      'Максимальна теплоефективність, швидкий прогрів. Обмеження температури — комфорт людини (до 31–35 °C).',
  },
  {
    id: 'pvc_glue',
    name: 'Клейовий кварцвініл / LVT плитка',
    thicknessM: 0.003,
    thermalConductivityWmK: 0.2,
    maxSurfaceTemperatureCelsius: 27,
    defaultUfhCircuitPresetId: 'ufh_dt10_40_30',
    notes: 'Монтується безпосередньо на клей. Мала товщина — висока тепловіддача.',
  },
  {
    id: 'pvc_click',
    name: 'Замковий кварцвініл SPC/LVT (разом із підкладкою)',
    thicknessM: 0.0065,
    thermalConductivityWmK: 0.14,
    maxSurfaceTemperatureCelsius: 27,
    defaultUfhCircuitPresetId: 'ufh_dt10_40_30',
    notes: 'Еквівалентний шар: вініл + підкладка ТП (~1,5 мм). Більший Rλ,B, ніж клейовий варіант.',
  },
  {
    id: 'laminate_click',
    name: 'Ламінат замковий (разом із підкладкою ТП)',
    thicknessM: 0.01,
    thermalConductivityWmK: 0.1,
    maxSurfaceTemperatureCelsius: 27,
    defaultUfhCircuitPresetId: 'ufh_dt10_40_30',
    notes: 'Еквівалент: ~8 мм HDF + ~2 мм перфорована підкладка. Повільніший прогрів.',
  },
];

/** @param {string} id @returns {FlooringFinishMaterial | null} */
export function getFlooringFinishMaterialById(id) {
  if (!id) return null;
  return FLOORING_FINISH_MATERIALS.find((m) => m.id === id) ?? null;
}

/**
 * Rλ,B только финишного покрытия, м²·K/Вт.
 *
 * @param {FlooringFinishMaterial} material
 * @returns {number}
 */
export function computeFinishCoveringResistanceM2KW(material) {
  const d = material.thicknessM;
  const lambda = material.thermalConductivityWmK;
  if (!(d > 0) || !(lambda > 0)) return 0;
  return Math.round((d / lambda) * 10000) / 10000;
}
