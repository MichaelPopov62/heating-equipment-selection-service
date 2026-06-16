/**
 * Назначение: допустимые схемы связки мощности котла и ГВС.
 * Описание: Единый источник значений heatingSystem.hotWaterBoilerPowerMatchingScheme для AJV, backend и UI.
 */

export const HOT_WATER_BOILER_MATCHING_SCHEME_ENUM = Object.freeze([
  'maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw',
  'heatingLoadWithReserveOnlySeparateElectricStorageWaterHeater',
  /** Одноконтурный котёл + БКН: P_total = P_отопл + P_нагрева бака. */
  'singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw',
  /** Двухконтурный котёл + буферный электробойлер (проток через котёл, бак — температурный буфер). */
  'combiBoilerWithBufferElectricStorage',
  /** Одноконтурный котёл + буферный электробойлер: котёл только по отоплению с запасом. */
  'singleCircuitBoilerWithBufferElectricStorage',
]);

/** Двухконтурный котёл: max(отопление с запасом, ГВС). */
export const SCHEME_BOILER_MAX_COMBI =
  HOT_WATER_BOILER_MATCHING_SCHEME_ENUM[0];

/** Котёл только отопление; ГВС — отдельный электронакопитель. */
export const SCHEME_BOILER_ELECTRIC_SEPARATE =
  HOT_WATER_BOILER_MATCHING_SCHEME_ENUM[1];

/** Одноконтурный котёл + БКН: сумма отопления с запасом и мощности нагрева бака. */
export const SCHEME_BOILER_SINGLE_INDIRECT_SUM =
  HOT_WATER_BOILER_MATCHING_SCHEME_ENUM[2];

/** Двухконтурный котёл + буферный электробойлер после контура ГВС котла. */
export const SCHEME_BOILER_COMBI_BUFFER_ELECTRIC =
  HOT_WATER_BOILER_MATCHING_SCHEME_ENUM[3];

/** Одноконтурный котёл + буферный электробойлер (ГВС через накопитель). */
export const SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC =
  HOT_WATER_BOILER_MATCHING_SCHEME_ENUM[4];

export const HOT_WATER_BOILER_POWER_MATCHING_SCHEME_OPTIONS = Object.freeze([
  {
    value: SCHEME_BOILER_MAX_COMBI,
    label:
      'Двухконтурный котёл: при открытии крана котёл переключается на горячую воду — номинал не ниже большего из двух (отопление с запасом и расчёт горячей воды)',
  },
  {
    value: SCHEME_BOILER_ELECTRIC_SEPARATE,
    label:
      'Одноконтурный котёл и накопительный электрический водонагреватель в розетке: котёл только по отоплению с запасом',
  },
  {
    value: SCHEME_BOILER_SINGLE_INDIRECT_SUM,
    label:
      'Одноконтурный котёл и бойлер косвенного нагрева (БКН): мощность котла — сумма отопления с запасом и нагрева бака за целевое время (не пик проточки)',
  },
  {
    value: SCHEME_BOILER_COMBI_BUFFER_ELECTRIC,
    label:
      'Двухконтурный котёл и буферный электробойлер: котёл греет проток ГВС (max отопления и пика), бойлер — температурный буфер меньшего объёма',
  },
  {
    value: SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC,
    label:
      'Одноконтурный котёл и буферный электробойлер: котёл только по отоплению с запасом, ГВС — накопительный электробойлер',
  },
]);
