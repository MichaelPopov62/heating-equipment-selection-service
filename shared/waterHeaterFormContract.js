/**
 * Назначение: контракт формы водонагревателя (shared frontend/backend).
 * Описание: Видимость галочки БКН и мерж objectMeta.indirectDhwSpaceAvailable для CalcInput.
 */

import { SCHEME_BOILER_SINGLE_INDIRECT_SUM } from './heatingMatchingSchemes.js';

/**
 * Галочка indirectDhwSpaceAvailable в UI — только квартира + схема 1К+БКН
 * (условие useIndirectDhw в backend/src/matching/index.js).
 *
 * @param {'apartment' | 'house' | string} objectType
 * @param {string} scheme
 * @returns {boolean}
 */
export function shouldShowIndirectDhwSpaceCheckbox(objectType, scheme) {
  return (
    objectType === 'apartment' && scheme === SCHEME_BOILER_SINGLE_INDIRECT_SUM
  );
}

/**
 * objectMeta для POST /api/v1/calc: флаг БКН только при квартире + 1К+БКН + галочка.
 *
 * @param {Record<string, unknown>} objectMeta
 * @param {{ hotWaterBoilerPowerMatchingScheme: string, indirectDhwSpaceAvailable: boolean }} waterHeaterForm
 * @returns {Record<string, unknown>}
 */
export function objectMetaForCalcPayload(objectMeta, waterHeaterForm) {
  const { indirectDhwSpaceAvailable: _legacy, ...rest } = objectMeta;
  void _legacy;

  if (
    objectMeta.objectType === 'apartment' &&
    waterHeaterForm.hotWaterBoilerPowerMatchingScheme ===
      SCHEME_BOILER_SINGLE_INDIRECT_SUM &&
    waterHeaterForm.indirectDhwSpaceAvailable === true
  ) {
    return { ...rest, indirectDhwSpaceAvailable: true };
  }

  return rest;
}
