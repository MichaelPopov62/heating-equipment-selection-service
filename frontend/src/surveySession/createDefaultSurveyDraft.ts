/**
 * Назначение: дефолтный рабочий черновик после «Начать новый расчёт».
 */

import { DEFAULT_HYDRAULICS_FORM } from '../types/hydraulics';
import { createDefaultWaterHeaterFormValue } from '../utils/waterHeaterFormDefaults';
import { createDefaultHotWaterFormValue } from '../utils/hotWaterFormDefaults';
import { migrateLegacyRoomTypes } from '../utils/migrateLegacyRoomTypes';
import {
  createDefaultExternalWall,
  migrateRoomEnvelopeFields,
} from '../utils/roomEnvelopeFields';
import { createDefaultWindowFormValue } from '../utils/roomWindowDefaults';
import { recommendedThermalRegimePresetForScheme } from '../types/heatingThermalRegime';
import { DEFAULT_RADIATOR_CONNECTION } from '../types/radiatorConnection';
import { DEFAULT_RADIATOR_EMITTER_PREFERENCE } from '../types/radiatorEmitterPreference';
import { adaptFlatRoomsToWiringLayout } from './wiringLayoutV3';
import { createInitialDraftSnapshot } from './migrateDerivedState';
import type { SurveyDraftSnapshot } from './types';

/**
 * @returns {SurveyDraftSnapshot} Черновик с одной комнатой и типовыми дефолтами дома.
 */
export function createDefaultSurveyDraftSnapshot(): SurveyDraftSnapshot {
  const waterHeaterForm = createDefaultWaterHeaterFormValue();
  const thermalRegimePreset = recommendedThermalRegimePresetForScheme(
    waterHeaterForm.hotWaterBoilerPowerMatchingScheme,
    'house',
  );

  const initialRooms = migrateRoomEnvelopeFields(
    migrateLegacyRoomTypes([
      {
        id: 'r1',
        name: 'Комната 1',
        type: 'помещение',
        floor: 1,
        topBoundaryType: 'heated',
        bottomBoundaryType: 'unheated',
        areaM2: '',
        heightM: 2.7,
        floorPresetId: '',
        ceilingPresetId: '',
        roofPresetId: '',
        externalWall1: createDefaultExternalWall(),
        externalWall2: createDefaultExternalWall(),
        ceilingAreaM2: '',
        roofAreaM2: '',
        windows: [createDefaultWindowFormValue('r1', 1)],
      },
    ]),
  );

  return createInitialDraftSnapshot({
    objectMeta: {
      objectType: 'house',
      apartmentStackPosition: 'middle_floor',
      floors: 1,
      roomsCount: 1,
      externalWalls: {
        presetId: 'wall_gas_concrete_d500',
        thicknessMm: 300,
        facadeSystem: 'none',
      },
      roofPresetId: 'roof_concrete_insulated_flat',
      boilerPlacementZone: 'kitchen',
      ventilationReserveMode: 'natural',
    },
    rooms: initialRooms,
    hotWaterForm: createDefaultHotWaterFormValue(),
    waterHeaterForm,
    thermalRegimePreset,
    radiatorConnection: DEFAULT_RADIATOR_CONNECTION,
    radiatorEmitterPreference: DEFAULT_RADIATOR_EMITTER_PREFERENCE,
    hydraulicsForm: { ...DEFAULT_HYDRAULICS_FORM },
    wiringLayoutV3: adaptFlatRoomsToWiringLayout(initialRooms, 'auto'),
  });
}
