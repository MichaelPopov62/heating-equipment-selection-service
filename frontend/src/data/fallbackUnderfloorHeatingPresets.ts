/**
 * Назначение: Офлайн-справочник базовых конструкций ТП.
 */

import type { UnderfloorHeatingBasePreset } from '../types/underfloorHeating';

export const DEFAULT_UNDERFLOOR_HEATING_BASE_ID = 'ufh_base_interstory_screed_65';

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
