/**
 * Назначение: типы формы шага «Гидравлика».
 */

export type HydraulicsPipeMaterialPreference = 'pex' | 'metal_plastic' | 'steel';

export type HydraulicsFormValue = {
  mainLineLengthM: number;
  deltaTSystemK: number;
  pipeMaterialPreference: HydraulicsPipeMaterialPreference | '';
};

export const DEFAULT_HYDRAULICS_FORM: HydraulicsFormValue = {
  mainLineLengthM: 8,
  deltaTSystemK: 20,
  pipeMaterialPreference: '',
};
