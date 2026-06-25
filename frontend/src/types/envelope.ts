/**
 * Назначение: Типы ограждений и метаданных объекта.
 * Описание: ObjectMetaValue, фасад, externalWalls и пресеты envelope для форм.
 */

export type ObjectType = 'house' | 'apartment';

/** Положение квартиры в стояке МКД. */
export type ApartmentStackPosition = 'first_floor' | 'middle_floor' | 'last_floor';

/** Учёт вентиляции в теплопотерях (kVent на комнату). */
export type VentilationReserveMode = 'natural' | 'recuperation';

/** Зона установки котла (только для дома). */
export type BoilerPlacementZone = 'kitchen' | 'living_zone' | 'boiler_room';

export type EnvelopePresetKind = 'wall' | 'window' | 'ceiling' | 'floor' | 'roof' | 'insulation';

/** Система утепления фасада (одна на объект). */
export type FacadeSystem = 'none' | 'sftk' | 'ventilated';

export type EnvelopePreset = {
  id: string;
  kind: EnvelopePresetKind;
  construction: string;
  material: string;
  description?: string;
  thicknessOptionsMm?: number[];
  uValue?: number;
  uModel?: {
    lambdaWmK: number;
    surfaceR: number;
    extraR?: number;
  };
};

/** Диапазон «количество помещений» — синхронно с backend validate / OpenAPI */
export const ROOMS_COUNT_MIN = 1;
export const ROOMS_COUNT_MAX = 50;

export type ObjectMetaValue = {
  objectType: ObjectType;
  /** Только для квартиры: этаж в стояке дома. */
  apartmentStackPosition?: ApartmentStackPosition;
  floors: 1 | 2 | 3;
  roomsCount: number;
  externalWalls: {
    presetId: string;
    thicknessMm?: number;
    /** none — без утеплителя; sftk — СФТК (ППС 16Ф); ventilated — минвата. */
    facadeSystem?: FacadeSystem;
    insulationPresetId?: string;
    insulationThicknessMm?: number;
  };
  roofPresetId?: string;
  /** Только для дома: где планируется котёл. */
  boilerPlacementZone?: BoilerPlacementZone;
  /** Запасной ввод геометрии котельной, если нет комнаты type=котельная. */
  boilerRoomAreaM2?: number;
  ceilingHeightM?: number;
  /** Только для API calc: выставляется из waterHeaterForm, не хранится на шаге «Объект». */
  indirectDhwSpaceAvailable?: boolean;
  /**
   * natural — kVent 1.3 (естественная вентиляция);
   * recuperation — kVent 1.1 (ПВУ с рекуператором).
   */
  ventilationReserveMode?: VentilationReserveMode;
};
