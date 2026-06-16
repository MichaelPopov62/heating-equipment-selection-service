/**
 * Назначение: Офлайн-справочник базовых конструкций ТП.
 */

import type { UnderfloorHeatingBasePreset } from '../types/underfloorHeating';

export const DEFAULT_UNDERFLOOR_HEATING_BASE_ID = 'ufh_base_interstory_screed_65';

/** Миграция устаревших монолитных presetId → base + finish */
export const LEGACY_MONOLITHIC_UFH_PRESET_MAP: Record<
  string,
  { basePresetId: string; finishMaterialId: string }
> = {
  underfloor_heating_glued_pvc_quartz_vinyl_interstory: {
    basePresetId: DEFAULT_UNDERFLOOR_HEATING_BASE_ID,
    finishMaterialId: 'pvc_glue',
  },
  underfloor_heating_floating_quartz_vinyl_interstory: {
    basePresetId: DEFAULT_UNDERFLOOR_HEATING_BASE_ID,
    finishMaterialId: 'pvc_click',
  },
};

function baseStub(id: string, name: string): UnderfloorHeatingBasePreset {
  return {
    id,
    name,
    description: '',
    usage: 'underfloor_heating_base',
    bottomBoundary: 'heated',
    baseCoveringResistanceM2KW: 0.0045,
    layers: [],
  };
}

export const FALLBACK_UNDERFLOOR_HEATING_BASES: UnderfloorHeatingBasePreset[] = [
  baseStub(
    DEFAULT_UNDERFLOOR_HEATING_BASE_ID,
    'Межэтажная основа (ГОСТ): плита + XPS 30 мм + стяжка ТП 65 мм',
  ),
  baseStub(
    'ufh_base_interstory_screed_65_xps50',
    'Межэтажная основа: плита + XPS 50 мм + стяжка ТП 65 мм',
  ),
  baseStub(
    'ufh_base_interstory_screed_65_xps80',
    'Межэтажная основа: плита + XPS 80 мм + стяжка ТП 65 мм',
  ),
  baseStub(
    'ufh_base_interstory_screed_65_xps100',
    'Межэтажная основа: плита + XPS 100 мм + стяжка ТП 65 мм',
  ),
];
