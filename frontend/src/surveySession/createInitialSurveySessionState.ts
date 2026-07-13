/**
 * Назначение: начальное состояние сессии анкеты.
 */

import { DEFAULT_HYDRAULICS_FORM } from '../types/hydraulics';
import { createDefaultWaterHeaterFormValue } from '../utils/waterHeaterFormDefaults';
import { migrateLegacyRoomTypes } from '../utils/migrateLegacyRoomTypes';
import {
  createDefaultExternalWall,
  migrateRoomEnvelopeFields,
} from '../utils/roomEnvelopeFields';
import { createDefaultWindowFormValue } from '../utils/roomWindowDefaults';
import { recommendedThermalRegimePresetForScheme } from '../types/heatingThermalRegime';
import { DEFAULT_RADIATOR_CONNECTION } from '../types/radiatorConnection';
import { DEFAULT_RADIATOR_EMITTER_PREFERENCE } from '../types/radiatorEmitterPreference';
import { buildCalcInputKeyFromDraft } from './buildCalcInputSnapshot';
import { createInitialDraftSnapshot } from './migrateDerivedState';
import { adaptFlatRoomsToWiringLayout } from './wiringLayoutV3';
import type { SurveySessionState } from './types';

/**
 * @returns {SurveySessionState}
 */
export function createInitialSurveySessionState(): SurveySessionState {
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

  const draft = createInitialDraftSnapshot({
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
    hotWaterForm: {
      residents: 0,
      coldWaterDesignSeason: 'winter',
      hotWaterC: 60,
      tropicalShower: false,
      fixtures: {
        shower: 0,
        bath: 0,
        sink: 0,
        toilet: 0,
        kitchenSink: 0,
        dishwasher: 0,
        laundrySink: 0,
        washingMachine: 0,
        bidet: 0,
      },
    },
    waterHeaterForm,
    thermalRegimePreset,
    radiatorConnection: DEFAULT_RADIATOR_CONNECTION,
    radiatorEmitterPreference: DEFAULT_RADIATOR_EMITTER_PREFERENCE,
    hydraulicsForm: { ...DEFAULT_HYDRAULICS_FORM },
    wiringLayoutV3: adaptFlatRoomsToWiringLayout(initialRooms, 'auto'),
  });

  const calcInputKey = buildCalcInputKeyFromDraft(draft);

  return {
    draft,
    report: null,
    reportEpoch: 0,
    uiPhase: 'idle',
    calcError: null,
    draftInitializing: false,
    thermalRegimeTouched: false,
    calcInputKey,
  };
}
