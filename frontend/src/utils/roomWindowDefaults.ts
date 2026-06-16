/**
 * Назначение: Дефолты полей окон в анкете помещения.
 * Описание: Единая фабрика WindowFormValue для App, useRoomsOrchestration и RoomAccordionItem.
 */

import { DEFAULT_WINDOW_PRESET_ID } from '../data/fallbackEnvelopePresets';
import type { WindowFormValue } from '../types/rooms';

/**
 * Создаёт пустую строку окна для формы комнаты.
 * @param roomId — id комнаты (r1, r2, …)
 * @param index — порядковый номер окна в комнате (1, 2, …)
 * @param presetId — пресет из справочника; иначе офлайн-дефолт
 */
export function createDefaultWindowFormValue(
  roomId: string,
  index = 1,
  presetId?: string,
): WindowFormValue {
  return {
    id: `win-${roomId}-${index}`,
    presetId: presetId?.trim() ? presetId : DEFAULT_WINDOW_PRESET_ID,
    openingWidthMm: '',
    openingHeightMm: '',
    orientation: 'N',
    count: 1,
  };
}
