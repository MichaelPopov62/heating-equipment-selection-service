/**
 * Назначение: Типы помещений анкеты.
 * Описание: RoomFormValue, окна, наружные стены, этаж и границы комнаты.
 */

export type RoomType =
  | 'прихожая'
  | 'тамбур'
  | 'гостиная'
  | 'коридор'
  | 'спальня'
  | 'кухня'
  | 'санузел'
  | 'тех'
  | 'котельная'
  | 'помещение';

export type WindowOrientation = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export type TopBoundaryType = 'heated' | 'unheated' | 'roof';

export type BottomBoundaryType = 'heated' | 'unheated';

/** Положение помещения относительно наружного контура (дом и квартира). */
export type RoomExteriorLayout = 'corner' | 'facade' | 'internal';

export type ExternalWallFormValue = {
  areaM2: number | '';
  orientation: WindowOrientation;
};

export type WindowFormValue = {
  id: string;
  presetId: string;
  openingWidthMm: number | '';
  openingHeightMm: number | '';
  orientation: WindowOrientation;
  count: number | '';
};

/** Тёплый пол: база + финиш (GET /api/v1/presets/underfloor-heating). */
export type UfhPipeSpacingMm = 100 | 150 | 200;

export type RoomUnderfloorHeatingFormValue = {
  enabled: boolean;
  basePresetId: string;
  finishMaterialId: string;
  /** Желаемый шаг укладки; сервер может подобрать меньший. */
  pipeSpacingMm?: UfhPipeSpacingMm;
  /** Площадь под мебелью без укладки ТП, м² (S_meb). */
  furnitureOccupiedAreaM2?: number | '';
  /** @deprecated Монолитный пресет; мигрируется в migrateRoomUnderfloorHeating */
  presetId?: string;
};

export type RoomFormValue = {
  id: string;
  name: string;
  type: RoomType;
  floor: 1 | 2 | 3;
  topBoundaryType: TopBoundaryType;
  bottomBoundaryType: BottomBoundaryType;
  areaM2: number | '';
  heightM: number | '';
  floorPresetId: string;
  ceilingPresetId: string;
  roofPresetId: string;
  /** Наружная стена №1 (основная). */
  externalWall1: ExternalWallFormValue;
  /** Наружная стена №2 (угловая/торцевая комната). */
  externalWall2: ExternalWallFormValue;
  /**
   * Положение относительно наружного контура:
   * corner — две фасадные; facade — одна фасадная; internal — стена в неотапливаемый корidor.
   */
  roomExteriorLayout?: RoomExteriorLayout;
  ceilingAreaM2: number | '';
  roofAreaM2: number | '';
  windows: WindowFormValue[];
  /** Сборка ТП (отдельно от floorPresetId для теплопотерь). */
  underfloorHeating?: RoomUnderfloorHeatingFormValue;
};
