/**
 * Назначение: синхронизация производного состояния черновика после мутации.
 * Описание: ТП, wiringLayoutV3 — живая pipeline-логика (НЕ compat-миграция черновиков).
 */

import type { RoomFormValue } from '../types/rooms';
import type { SurveyDraftSnapshot, SurveyMutation } from './types';
import { DEFAULT_RADIATOR_CONNECTION } from '../types/radiatorConnection';
import { DEFAULT_RADIATOR_EMITTER_PREFERENCE } from '../types/radiatorEmitterPreference';
import type { WiringLayoutV3 } from './wiringLayoutV3';
import {
  adaptFlatRoomsToWiringLayout,
  createDefaultWiringLayout,
  migrateWiringLayoutOnSystemTypeChange,
} from './wiringLayoutV3';

/**
 * Снять ТП в комнатах при глобальном отключении.
 *
 * @param rooms
 */
function clearRoomUnderfloorHeating(rooms: RoomFormValue[]): RoomFormValue[] {
  return rooms.map((r) => {
    if (!r.underfloorHeating?.enabled) return r;
    return {
      ...r,
      underfloorHeating: { ...r.underfloorHeating, enabled: false },
    };
  });
}

/**
 * Заполнить ветки layout, если комнаты есть, а branches пусты.
 *
 * @param draft
 */
function ensureWiringBranches(draft: SurveyDraftSnapshot): SurveyDraftSnapshot {
  if (draft.rooms.length === 0 || draft.wiringLayoutV3.branches.length > 0) {
    return draft;
  }
  return {
    ...draft,
    wiringLayoutV3: adaptFlatRoomsToWiringLayout(
      draft.rooms,
      draft.wiringLayoutV3.systemType,
    ),
  };
}

/**
 * Пересборка layout v3 из комнат и флагов ТП.
 *
 * @param draft
 */
function rebuildWiringLayout(draft: SurveyDraftSnapshot): WiringLayoutV3 {
  const defaultLen =
    draft.hydraulicsForm.mainLineLengthM > 0
      ? Math.min(draft.hydraulicsForm.mainLineLengthM, 8)
      : 4;
  const systemType = draft.wiringLayoutV3.systemType;
  return adaptFlatRoomsToWiringLayout(draft.rooms, systemType, defaultLen);
}

/**
 * @param draft — черновик после reduce
 * @param mutation — последняя мутация
 * @returns {SurveyDraftSnapshot}
 */
export function migrateDerivedState(
  draft: SurveyDraftSnapshot,
  mutation: SurveyMutation,
): SurveyDraftSnapshot {
  if (mutation.type === 'HEATING_EMITTERS_MODE_SET') {
    if (mutation.presetId == null) {
      const rooms = clearRoomUnderfloorHeating(draft.rooms);
      return {
        ...draft,
        ufhPresetId: mutation.presetId,
        waterUnderfloorHeating: false,
        rooms,
        wiringLayoutV3: adaptFlatRoomsToWiringLayout(
          rooms,
          draft.wiringLayoutV3.systemType,
        ),
      };
    }
    const next: SurveyDraftSnapshot = {
      ...draft,
      ufhPresetId: mutation.presetId,
      waterUnderfloorHeating: true,
    };
    return {
      ...next,
      wiringLayoutV3: rebuildWiringLayout(next),
    };
  }

  if (mutation.type === 'WATER_UFH_FLAG_SET') {
    const next: SurveyDraftSnapshot = {
      ...draft,
      waterUnderfloorHeating: mutation.enabled,
      ufhPresetId: mutation.enabled ? draft.ufhPresetId : null,
      rooms: mutation.enabled
        ? draft.rooms
        : clearRoomUnderfloorHeating(draft.rooms),
    };
    return {
      ...next,
      wiringLayoutV3: rebuildWiringLayout(next),
    };
  }

  if (mutation.type === 'WIRING_SCHEME_SET') {
    return {
      ...draft,
      wiringLayoutV3: migrateWiringLayoutOnSystemTypeChange(
        draft.wiringLayoutV3,
        draft.rooms,
        mutation.systemType,
      ),
    };
  }

  if (mutation.type === 'SET_ROOMS') {
    return {
      ...draft,
      wiringLayoutV3: migrateWiringLayoutOnSystemTypeChange(
        draft.wiringLayoutV3,
        draft.rooms,
        draft.wiringLayoutV3.systemType,
      ),
    };
  }

  if (mutation.type === 'DRAFT_LOADED') {
    return ensureWiringBranches(draft);
  }

  if (mutation.type === 'SET_CURRENT_STEP' && mutation.step === 'hydraulics') {
    return ensureWiringBranches(draft);
  }

  return ensureWiringBranches(draft);
}

/**
 * @returns {SurveyDraftSnapshot} Начальный черновик сессии.
 */
export function createInitialDraftSnapshot(
  partial: Partial<SurveyDraftSnapshot> &
    Pick<
      SurveyDraftSnapshot,
      | 'objectMeta'
      | 'hotWaterForm'
      | 'waterHeaterForm'
      | 'thermalRegimePreset'
      | 'hydraulicsForm'
    >,
): SurveyDraftSnapshot {
  return {
    currentStep: partial.currentStep ?? 'object',
    objectMeta: partial.objectMeta,
    rooms: partial.rooms ?? [],
    temps: partial.temps ?? { insideC: 20, outsideC: -5 },
    hotWaterForm: partial.hotWaterForm,
    waterHeaterForm: partial.waterHeaterForm,
    waterUnderfloorHeating: partial.waterUnderfloorHeating ?? false,
    underfloorDistributionPreset:
      partial.underfloorDistributionPreset ?? 'auto',
    thermalRegimePreset: partial.thermalRegimePreset,
    radiatorConnection: partial.radiatorConnection ?? DEFAULT_RADIATOR_CONNECTION,
    radiatorEmitterPreference:
      partial.radiatorEmitterPreference ?? DEFAULT_RADIATOR_EMITTER_PREFERENCE,
    ufhPresetId: partial.ufhPresetId ?? null,
    hydraulicsForm: partial.hydraulicsForm,
    wiringLayoutV3: partial.wiringLayoutV3 ?? createDefaultWiringLayout(),
  };
}
