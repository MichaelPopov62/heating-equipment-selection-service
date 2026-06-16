/**
 * Назначение: типы схем связки мощности котла и ГВС.
 * Описание: Декларации констант и enum из heatingMatchingSchemes.js для TypeScript frontend и JSDoc backend.
 */
export declare const HOT_WATER_BOILER_MATCHING_SCHEME_ENUM: readonly [
  'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
  'heatingLoadWithReserveOnlySeparateElectricStorageWaterHeater',
  'singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw',
  'combiBoilerWithBufferElectricStorage',
  'singleCircuitBoilerWithBufferElectricStorage',
];

export declare const SCHEME_BOILER_MAX_COMBI: 'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw';
export declare const SCHEME_BOILER_ELECTRIC_SEPARATE: 'heatingLoadWithReserveOnlySeparateElectricStorageWaterHeater';
export declare const SCHEME_BOILER_SINGLE_INDIRECT_SUM: 'singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw';
export declare const SCHEME_BOILER_COMBI_BUFFER_ELECTRIC: 'combiBoilerWithBufferElectricStorage';
export declare const SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC: 'singleCircuitBoilerWithBufferElectricStorage';

export declare const HOT_WATER_BOILER_POWER_MATCHING_SCHEME_OPTIONS: readonly {
  value:
    | 'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw'
    | 'heatingLoadWithReserveOnlySeparateElectricStorageWaterHeater'
    | 'singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw'
    | 'combiBoilerWithBufferElectricStorage'
    | 'singleCircuitBoilerWithBufferElectricStorage';
  label: string;
}[];
