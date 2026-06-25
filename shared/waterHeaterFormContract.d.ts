/**
 * Типы контракта формы водонагревателя (shared).
 */

import type { HotWaterBoilerPowerMatchingScheme } from './heatingMatchingSchemes.js';

export type WaterHeaterFormContractValue = {
  hotWaterBoilerPowerMatchingScheme: HotWaterBoilerPowerMatchingScheme | string;
  indirectDhwSpaceAvailable: boolean;
};

export declare function shouldShowIndirectDhwSpaceCheckbox(
  objectType: string,
  scheme: string,
): boolean;

export declare function objectMetaForCalcPayload<T extends Record<string, unknown>>(
  objectMeta: T,
  waterHeaterForm: WaterHeaterFormContractValue,
): T;
