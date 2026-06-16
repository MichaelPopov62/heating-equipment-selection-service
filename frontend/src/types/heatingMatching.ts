/**
 * Назначение: Типы схем подбора котла с ГВС.
 * Описание: Реэкспорт констант и HotWaterBoilerPowerMatchingScheme из shared-модуля.
 */

import {
  HOT_WATER_BOILER_MATCHING_SCHEME_ENUM,
  HOT_WATER_BOILER_POWER_MATCHING_SCHEME_OPTIONS as SHARED_BOILER_MATCHING_OPTIONS,
  SCHEME_BOILER_COMBI_BUFFER_ELECTRIC,
  SCHEME_BOILER_ELECTRIC_SEPARATE,
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
} from '../../../shared/heatingMatchingSchemes.js';

/** Как на сервере в openapi / HeatingSystemInput — без сокращений в строковых значениях. */
export type HotWaterBoilerPowerMatchingScheme =
  (typeof HOT_WATER_BOILER_MATCHING_SCHEME_ENUM)[number];

/** Подписи для UI — источник данных общий с backend AJV (`shared/heatingMatchingSchemes.js`). */
export const HOT_WATER_BOILER_POWER_MATCHING_SCHEME_OPTIONS =
  SHARED_BOILER_MATCHING_OPTIONS;

export {
  SCHEME_BOILER_COMBI_BUFFER_ELECTRIC,
  SCHEME_BOILER_ELECTRIC_SEPARATE,
  SCHEME_BOILER_MAX_COMBI,
  SCHEME_BOILER_SINGLE_BUFFER_ELECTRIC,
  SCHEME_BOILER_SINGLE_INDIRECT_SUM,
};
