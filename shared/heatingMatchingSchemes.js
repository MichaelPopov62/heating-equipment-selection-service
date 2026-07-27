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
      'Двоконтурний котел: при відкритті крана котел перемикається на гарячу воду — номінал не нижче більшого з двох (опалення з запасом і розрахунок гарячої води)',
  },
  {
    value: SCHEME_BOILER_ELECTRIC_SEPARATE,
    label:
      'Одноконтурний котел і накопичувальний електричний водонагрівач у розетці: котел лише за опаленням з запасом',
  },
  {
    value: SCHEME_BOILER_SINGLE_INDIRECT_SUM,
    label:
      'Одноконтурний котел і бойлер непрямого нагрівання (БКН): потужність котла — сума опалення з запасом і нагрівання бака за цільовий час (не пік протоку)',
  },
  {
    value: SCHEME_BOILER_COMBI_BUFFER_ELECTRIC,
    label:
      'Двоконтурний котел і буферний електробойлер: котел нагріває проток ГВП (max опалення та піку), бойлер — температурний буфер меншого об\'єму',
  },
  {
    value: SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC,
    label:
      'Одноконтурний котел і буферний електробойлер: котел лише за опаленням з запасом, ГВП — накопичувальний електробойлер',
  },
]);
