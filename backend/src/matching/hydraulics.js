/**
 * Назначение: тонкая обёртка подбора гидравлики для matching-слоя.
 * Описание: Вызывается из buildReport после matchEquipment.
 */

export {
  buildHydraulicsSnapshots,
  runHydraulicsPipeline,
  validateHydraulicsPipelineInput,
} from '../hydraulics/public.js';
