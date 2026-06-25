/**
 * Назначение: Типы формы шага «Водонагреватель».
 * Описание: Стратегические решения пользователя — схема связки котёл/ГВС и место под БКН (квартира).
 */

import type { HotWaterBoilerPowerMatchingScheme } from './heatingMatching';

/** Состояние шага «Водонагреватель» (отправляется в API через buildCalcRequestPayload). */
export type WaterHeaterFormValue = {
  /** heatingSystem.hotWaterBoilerPowerMatchingScheme */
  hotWaterBoilerPowerMatchingScheme: HotWaterBoilerPowerMatchingScheme;
  /**
   * objectMeta.indirectDhwSpaceAvailable — учитывается бэкендом только для квартиры
   * при схеме singleCircuitBoilerWithIndirectTankHeatingPlusTankPowerKw.
   */
  indirectDhwSpaceAvailable: boolean;
};
