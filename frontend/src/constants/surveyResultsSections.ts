/**
 * Назначение: Якоря секций сайдбара «Результаты» для кнопок «Назад к результатам».
 * Описание: SSOT id для ТП, ГВ, водонагревателя, радиаторов, котла и гидравлики.
 */

export const RESULTS_SECTION_IDS = {
  /** Таблица точек водоразбора (HotWaterFixturesSummaryTable). */
  hotWater: 'results-hot-water',
  /** Итог ТП (UnderfloorHeatingSummaryTable). */
  warmFloor: 'results-warm-floor',
  /** Итог подбора ЭБ/БКН (HotWaterSummaryTable). */
  waterHeater: 'results-water-heater',
  /** Итог подбора радиаторов (RadiatorsSummaryTable). */
  radiators: 'results-radiators',
  /** Итог подбора котла (BoilerSummaryTable). */
  boiler: 'results-boiler',
  /** Итог гидравлики (HydraulicsSummaryTable). */
  hydraulics: 'results-hydraulics',
} as const;

export type ResultsSectionId =
  (typeof RESULTS_SECTION_IDS)[keyof typeof RESULTS_SECTION_IDS];

/** Заголовок блока «Результаты расчёта» — fallback, если секции ещё нет в DOM. */
export const RESULTS_ROOT_ID = 'calculation-results-title';
