/**
 * Назначение: общие типы DTO и контрактов REST API и отчёта расчёта.
 * Описание: Используются из JS через JSDoc import(); в рантайме Node.js не подключается — только проверка типов.
 */

import type { NormalizedCatalog } from '../catalog/types';
import type {
  BoilerCombustionType,
  BoilerMatchingReport,
  HotWaterBoilerPowerMatchingScheme,
} from './boiler-types';

export type {
  BoilerCombustionType,
  HotWaterBoilerPowerMatchingScheme,
  BoilerMatchingRecommendation,
  BoilerEquipmentProposal,
  BoilerMatchingReport,
} from './boiler-types';

export interface ErrorDetailsAjvItem {
  instancePath?: string;
  message?: string;
  keyword?: string;
  params?: unknown;
  schemaPath?: string;
}

/** Тип объекта в анкете (дом / квартира) — влияет на сценарии ГВС и нормы. */
export type BuildingObjectType = 'house' | 'apartment';

export interface AppErrorLike {
  statusCode?: number;
  status?: number;
  code?: string;
  message?: string;
  details?: ErrorDetailsAjvItem[];
  type?: string;
  body?: unknown;
}

export interface ErrorEnvelope {
  ok: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    details?: ErrorDetailsAjvItem[];
  };
}

export interface HealthOkResponse {
  ok: true;
  status: 'up';
}

/** Ответ POST /api/v1/system/invalidate-reference-cache */
export interface InvalidateReferenceCacheOkResponse {
  ok: true;
  referenceBundleLoadedAt: number;
  catalogSource: 'file' | 'mongo';
  waterNormsSource: 'file' | 'mongo';
  appliancesSource: 'file' | 'mongo';
  recommendationsSource: 'file' | 'mongo';
  ufhPresetsSource: 'file' | 'mongo';
}

export interface EnvelopePresetsResponse {
  ok: true;
  presets: EnvelopePreset[];
}

/** Слой сборки ТП (толщина в метрах, λ в Вт/(м·К)). */
export interface UnderfloorHeatingAssemblyLayer {
  name: string;
  thicknessM: number;
  thermalConductivityWmK: number;
  isHeatingLayer: boolean;
  optional?: boolean;
  note?: string;
}

/** Пресет температуры контура ТП (отдельно от радиаторов). */
export type UfhCircuitPresetId = 'ufh_dt10_45_35' | 'ufh_dt10_40_30';

/** Схема распределения при смешанной системе радиаторы + ТП. */
export type UfhDistributionPreset =
  | 'auto'
  | 'collector_mixing_valve'
  | 'hydraulic_separator';

/** Ориентиры узла смешения ТП (насос + клапан). */
export interface UfhMixingNodeSpec {
  isMixingNodeRequired: boolean;
  boilerSupplyC?: number;
  floorCircuitSupplyC?: number;
  deltaTK?: number;
  powerKw?: number;
  flowRateM3PerHour?: number;
  headMetersMin?: number;
  valveKvsMin?: number;
  distributionPreset?: UfhDistributionPreset;
  notes?: string[];
}

/** Финишное покрытие пола для расчёта ТП (отдельно от базового конструктива). */
export interface FlooringFinishMaterial {
  id: string;
  name: string;
  thicknessM: number;
  thermalConductivityWmK: number;
  maxSurfaceTemperatureCelsius: number;
  /** Нормативный комфортный лимит Tповерх (напр. плитка в жилой зоне). */
  comfortMaxSurfaceTemperatureCelsius?: number;
  /** Пресет контура ТП для этого финиша (см. shared/ufhCircuitPresets.js). */
  defaultUfhCircuitPresetId?: UfhCircuitPresetId;
  notes?: string;
}

/** Базовый конструктив ТП без финиша (usage=underfloor_heating_base). */
export interface UnderfloorHeatingBasePreset {
  id: string;
  name: string;
  description?: string;
  usage: 'underfloor_heating_base';
  bottomBoundary?: 'heated' | 'unheated';
  /** Rλ,B слоёв базы над isHeatingLayer (без финиша). */
  baseCoveringResistanceM2KW: number;
  layers: UnderfloorHeatingAssemblyLayer[];
}

/** @deprecated Монолитные пресеты заменены на base + finish */
export type UnderfloorHeatingAssemblyPreset = UnderfloorHeatingBasePreset;

export interface UnderfloorHeatingBasesResponse {
  ok: true;
  bases: UnderfloorHeatingBasePreset[];
}

export interface FlooringFinishesResponse {
  ok: true;
  finishes: FlooringFinishMaterial[];
}

export interface UnderfloorHeatingPresetsBundleResponse {
  ok: true;
  bases: UnderfloorHeatingBasePreset[];
  finishes: FlooringFinishMaterial[];
}

export interface CatalogResponse {
  ok: true;
  catalog: NormalizedCatalog;
  /** Откуда загружен каталог при старте API: файл или MongoDB. */
  catalogSource: 'file' | 'mongo';
}

/** Источники снимка справочников в одном расчёте (meta / ctx.sources). */
export interface CalcRuntimeContextSources {
  catalog: 'file' | 'mongo';
  waterNorms: 'file' | 'mongo';
  appliances: 'file' | 'mongo';
  recommendations: 'file' | 'mongo';
  ufhPresets: 'file' | 'mongo';
  loadedAt: number;
}

/**
 * Снимок справочников для одного calc без I/O.
 * Создаётся через toCalcRuntimeContext(getReferenceBundle()) на composition root.
 */
export interface CalcRuntimeContext {
  catalog: NormalizedCatalog;
  waterNorms: import('../dhw/types').NormalizedWaterNorms;
  appliances: import('../dhw/types').AppliancesBundle;
  recommendations: import('../recommendations/types').RecommendationsBundle;
  ufhPresets: import('../ufh/types').UnderfloorHeatingPresetsBundle;
  sources: CalcRuntimeContextSources;
}

export interface LocationInput {
  address?: string;
  lat?: number;
  lon?: number;
}

export interface TempsInput {
  insideC: number;
  outsideC?: number;
}

export type RoomType =
  | 'прихожая'
  | 'гостиная'
  | 'коридор'
  | 'спальня'
  | 'кухня'
  | 'санузел'
  | 'тех'
  | 'котельная'
  | 'помещение';

/** Зона планируемой установки котла (только для objectType house). */
export type BoilerPlacementZone = 'kitchen' | 'living_zone' | 'boiler_room';

/** Тёплый пол в комнате: база + финиш (не envelopePresets). */
export interface RoomUnderfloorHeatingInput {
  enabled: boolean;
  basePresetId: string;
  finishMaterialId: string;
  /** Шаг укладки трубы, мм: 100 | 150 | 200; по умолчанию 150. */
  pipeSpacingMm?: 100 | 150 | 200;
  /** @deprecated Миграция монолитных пресетов; не задавать в новых анкетах */
  presetId?: string;
}

export interface RoomInput {
  id: string;
  name: string;
  type: RoomType;
  /**
   * Этаж комнаты (1..3). Нужен, чтобы различать верхний/не верхний этаж.
   */
  floor: 1 | 2 | 3;
  /**
   * Тип верхней границы комнаты:
   * - heated: сверху тёплое помещение (потолок не считаем)
   * - unheated: сверху холодная зона/чердак (считаем потолок)
   * - roof: мансарда (считаем кровлю/скаты)
   */
  topBoundary: 'heated' | 'unheated' | 'roof';
  /** Снизу тёплый контур (heated) — пол не считаем; unheated — считаем пол. */
  bottomBoundary: 'heated' | 'unheated';
  areaM2: number;
  heightM: number;
  /**
   * Положение относительно наружного контура (угловое / фасад / внутреннее).
   * Влияет на heatLossFactor и ΔT стен в heatlossByRooms.
   */
  roomExteriorLayout?: 'corner' | 'facade' | 'internal';
  /** Сборка водяного ТП (фаза 2: warmFloorCalc). Только при heatingSystem.waterUnderfloorHeating. */
  underfloorHeating?: RoomUnderfloorHeatingInput;
}

export interface EnvelopeElementInput {
  kind?: 'wall' | 'window' | 'ceiling' | 'floor' | 'roof';
  roomId: string;
  name?: string;
  construction: string;
  material?: string;
  presetId?: string;
  uValue?: number;
  thicknessMm?: number;
  areaM2: number;
  /**
   * Количество одинаковых элементов (например, одинаковых окон).
   * Если задано, площадь элемента для расчёта считается как areaM2 × count.
   */
  count?: number;
  /**
   * Ориентация наружной стены или окна по сторонам света (поправка β по СП 60.13330).
   */
  orientation?: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
  /**
   * Ширина оконного проёма (мм). Нужна для проверки правила 70% по радиатору.
   */
  openingWidthMm?: number;
  /**
   * Высота оконного проёма (мм). Опционально; может использоваться для автоподсчёта площади.
   */
  openingHeightMm?: number;
}

export type EnvelopePresetKind = 'wall' | 'window' | 'ceiling' | 'floor' | 'roof' | 'insulation';

export interface EnvelopePresetUModel {
  lambdaWmK: number;
  surfaceR: number;
  extraR?: number;
}

export interface BuildingObjectMetaExternalWalls {
  /** presetId несущего слоя (EnvelopePreset kind=wall), без утеплителя. */
  presetId: string;
  /** Толщина несущего слоя, мм. */
  thicknessMm?: number;
  /**
   * none | sftk | ventilated — одна система утепления на объект.
   * U: R = Rsi+Rse + dст/λст + dут/λут; U = 1/R (wallAssembly.js).
   */
  facadeSystem?: 'none' | 'sftk' | 'ventilated';
  /** presetId утеплителя (kind=insulation); обязателен при sftk/ventilated. */
  insulationPresetId?: string;
  /** Толщина утеплителя, мм. */
  insulationThicknessMm?: number;
}

export type ApartmentStackPosition = 'first_floor' | 'middle_floor' | 'last_floor';

export interface BuildingObjectMeta {
  objectType: BuildingObjectType;
  /** Положение квартиры в стояке МКД (только apartment). */
  apartmentStackPosition?: ApartmentStackPosition;
  floors: 1 | 2 | 3;
  /** Число помещений по плану (валидация API: 1…50) */
  roomsCount: number;
  externalWalls: BuildingObjectMetaExternalWalls;
  /**
   * Источник тепла в контуре:
   * - individual — котёл в квартире/доме;
   * - central — общедомовой контур высокого давления (ориентир на биметалл/усиленные секции).
   */
  heatingDistribution?: 'individual' | 'central';
  /**
   * presetId кровли. Если не задан — потери по кровле не считаем.
   */
  roofPresetId?: string;
  /**
   * Где планируется установка котла (только дом). kitchen / living_zone — настенные;
   * boiler_room — допускается напольный при достаточном объёме котельной.
   */
  boilerPlacementZone?: BoilerPlacementZone;
  /**
   * Площадь котельной, м² (запасной ввод, если нет комнаты type=котельная в rooms).
   */
  boilerRoomAreaM2?: number;
  /**
   * Высота потолка котельной, м (вместе с boilerRoomAreaM2).
   */
  ceilingHeightM?: number;
  /**
   * Квартира: есть техпомещение/ниша под БКН (для больших квартир и схемы «1К + БКН»).
   */
  indirectDhwSpaceAvailable?: boolean;
  /**
   * Режим учёта вентиляции в теплопотерях по комнатам (MVP: kVent на envelopeWatts).
   * natural — kVent 1.3; recuperation — kVent 1.1 (рекуператор).
   */
  ventilationReserveMode?: 'natural' | 'recuperation';
}

export interface VentilationInput {
  flowM3PerHour?: number;
  airChangesPerHour?: number;
}

export interface HeatLossCalcElementInput {
  name?: string | null;
  construction?: string | null;
  material?: string | null;
  areaM2: number;
  uValue?: number | null;
  /**
   * ΔT для элемента, K. Если не задан — используется глобальный inside−outside.
   */
  deltaT?: number | null;
  /**
   * Дополнительный множитель теплопотерь (ориентация × угловая комната).
   * По умолчанию 1.0.
   */
  heatLossFactor?: number | null;
  cornerRoomFactor?: number | null;
  adjacentTempC?: number | null;
  kind?: 'wall' | 'window' | 'ceiling' | 'floor' | 'roof' | null;
  count?: number | null;
  orientation?: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | null;
  openingWidthMm?: number | null;
  openingHeightMm?: number | null;
}

export interface HeatLossCalcVentilationInput {
  flowM3PerHour?: number;
  airChangesPerHour?: number;
  volumeM3?: number;
}

export interface HeatLossCalcInput {
  insideTempC: number;
  outsideTempC: number;
  elements: HeatLossCalcElementInput[];
  ventilation?: HeatLossCalcVentilationInput | null;
}

export interface HeatLossCalcResult {
  insideTempC: number;
  outsideTempC: number;
  deltaT: number;
  envelope: {
    watts: number;
    elements: HeatLossElementReport[];
  };
  ventilation: {
    method: string | null;
    watts: number;
  };
  totalWatts: number;
}

export interface BuildingInput {
  temps?: TempsInput;
  objectMeta?: BuildingObjectMeta;
  rooms: RoomInput[];
  envelopeElements: EnvelopeElementInput[];
  ventilation?: VentilationInput;
}

/**
 * Пресет **радиаторного** графика (см. heatingThermalRegimes.js).
 * Массовый рынок: 75/65 (traditional_dt50_75_65), 55/45 (condensing_dt30_55_45).
 * traditional_high_dt70_95_85 (95/85) — устаревший, только API.
 */
export type HeatingThermalRegimePreset =
  | 'traditional_high_dt70_95_85'
  | 'traditional_dt50_75_65'
  | 'condensing_dt30_55_45';

export interface HeatingSystemInput {
  supplyC?: number;
  returnC?: number;
  insideC?: number;
  radiatorReferenceDeltaT?: 50 | 70;
  /**
   * Предпочтение камеры котла под подбор каталога: турбо (коакс) или атмосферный тяговый.
   */
  boilerCombustionType?: BoilerCombustionType;
  /**
   * Схема подводки к радиатору (для подсказок по панельным сериям K / VK / VKP).
   */
  radiatorConnection?: 'side' | 'bottom';
  /**
   * Связка «котёл — горячая вода» для расчёта требуемой мощности котла.
   * Если не задано — применяется сценарий maximumBetweenHeatingLoadWithReserveAndHotWaterPowerKw.
   */
  hotWaterBoilerPowerMatchingScheme?: HotWaterBoilerPowerMatchingScheme;
  /** В проекте предусмотрен водяной тёплый пол (подсказки при подборе излучателей). */
  waterUnderfloorHeating?: boolean;
  /** Режим ТП из справочника underfloor_heating_presets. */
  ufhPresetId?: 'ufh_only' | 'ufh_mixed_radiators' | 'ufh_direct_tile' | 'ufh_direct_laminate';
  /** Режим излучателей: radiators | mixed | ufh_only. */
  heatingEmittersMode?: 'radiators' | 'mixed' | 'ufh_only';
  /** Схема подключения ТП; по умолчанию auto (нормализация — roadmap). */
  underfloorDistributionPreset?: UfhDistributionPreset;
  /**
   * Пресет графика отопления: задаёт supplyC/returnC и по умолчанию radiatorReferenceDeltaT.
   * Если не указан — подставляются 75/65 °C (прежнее поведение API).
   */
  thermalRegimePreset?: HeatingThermalRegimePreset;

  /**
   * Служебное поле: после normalize в validate при авто-смене несостыковочной схемы (временно до matchEquipment).
   * Клиенту не задаётся; удаляется в matchEquipment после переноса в matching.boiler.warnings.
   */
  _normalizationWarnings?: string[];
}

export interface HotWaterFixturesInput {
  shower?: number;
  bath?: number;
  /** Раковина в санузле */
  sink?: number;
  toilet?: number;
  /** Кухонная мойка / смеситель */
  kitchenSink?: number;
  /** Посудомоечная машина (подвод горячей воды) */
  dishwasher?: number;
  /** Мойка (хозблок / прачечная) */
  laundrySink?: number;
  /** Стиральная машина (техпомещение / прачечная) */
  washingMachine?: number;
  bidet?: number;
}

export interface HotWaterInput {
  residents?: number;
  /**
   * Сезон для расчётной температуры холодной воды: зима +5 °C, лето +15 °C.
   * Если не задано — winter.
   */
  coldWaterDesignSeason?: 'winter' | 'summer';
  /** Температура горячей воды после подогрева, °C (55…60) */
  hotWaterC?: number;
  fixtures?: HotWaterFixturesInput;
  /**
   * Усиленный душ (повышенный расход): для дома с накопителем увеличивает рекомендуемый объём бака на 30 %.
   */
  tropicalShower?: boolean;
}

export interface HydraulicsInput {
  mainLineLengthM?: number;
  deltaTSystemK?: number;
}

export interface CalcRequestBody {
  location?: LocationInput;
  temps?: TempsInput;
  building: BuildingInput;
  heatingSystem?: HeatingSystemInput;
  hotWater?: HotWaterInput;
  hydraulics?: HydraulicsInput;
}

export type ClimateSource = 'meteostat';

export interface ClimateSnapshot {
  source: ClimateSource;
  lat: number;
  lon: number;
  displayName: string | null;
  designOutsideTempC: number;
}

export interface HeatLossReport {
  totalWatts: number;
  insideC?: number;
  outsideC?: number;
  deltaT?: number;
  envelopeWatts?: number;
  ventilation?: {
    method: string | null;
    watts: number;
    ventilationReserveMode?: 'natural' | 'recuperation';
    kVent?: number;
    label?: string;
  };
  rooms?: HeatLossRoomReport[];
}

/** Расчёт теплоотдачи ТП по одной комнате (warmFloorCalc.js). */
export interface UnderfloorHeatingRoomReport {
  roomId: string;
  roomName: string;
  basePresetId: string;
  finishMaterialId: string;
  basePresetName?: string;
  finishMaterialName?: string;
  areaM2: number;
  pipeSpacingMm: number;
  pipeEmbedmentResistanceM2KW: number;
  baseCoveringResistanceM2KW: number;
  finishCoveringResistanceM2KW: number;
  coveringResistanceM2KW: number;
  resistanceUpM2KW: number;
  resistanceDownM2KW: number;
  /** Пресет контура ТП по финишу (roadmap фаза 3). */
  ufhCircuitPresetId?: UfhCircuitPresetId;
  circuitSupplyC: number;
  circuitReturnC: number;
  circuitMeanC: number;
  /** Теплопотери комнаты для проверки покрытия (roadmap). */
  roomHeatLossWatts?: number;
  heatFluxCoverageRatio?: number;
  heatFluxUpWm2: number;
  heatFluxDownWm2: number;
  maxAllowableHeatFluxUpWm2: number;
  heatFluxUpWatts: number;
  heatFluxDownWatts: number;
  surfaceTempC: number;
  /** Применённый лимит поверхности (min пресета Mongo и паспорта финиша). */
  maxSurfaceTemperatureCelsius: number;
  comfortMaxSurfaceTemperatureCelsius?: number;
  /** Паспортный лимит финиша до учёта пресета режима ТП. */
  finishMaxSurfaceTemperatureCelsius?: number;
  /** Лимит из underfloor_heating_presets.technical.maxSurfaceTemperatureC. */
  presetMaxSurfaceTemperatureCelsius?: number;
  /** q↑ снижен до maxAllowableHeatFluxUpWm2 из-за лимита поверхности. */
  heatFluxUpLimitedBySurface?: boolean;
  bottomBoundary: 'heated' | 'unheated';
  neighborTempC: number;
  warnings: string[];
}

/** Блок report.calculations.underfloorHeating. */
export interface UnderfloorHeatingReport {
  enabled: boolean;
  circuitSupplyC: number;
  circuitReturnC: number;
  circuitMeanC: number;
  circuitSource: 'heatingSystem' | 'mixed_default' | 'finish_preset' | 'ufh_mode_preset';
  isMixingNodeRequired?: boolean;
  mixingNode?: UfhMixingNodeSpec | null;
  distributionPreset?: UfhDistributionPreset;
  underfloorHydraulics?: {
    deltaTK?: number;
    flowRateM3PerHour?: number;
    massFlowKgPerSec?: number;
  };
  rooms: UnderfloorHeatingRoomReport[];
  totalHeatFluxUpWatts: number;
  totalHeatFluxDownWatts: number;
  warnings: string[];
  resolvedRecommendations?: import('../recommendations/types').ResolvedRecommendation[];
}

export interface HeatLossElementReport {
  name: string | null;
  construction: string | null;
  material: string | null;
  areaM2: number;
  uValue: number;
  deltaT: number;
  /**
   * Базовые потери элемента без поправочных коэффициентов (Вт).
   */
  baseQWatts?: number;
  /**
   * Итоговый множитель к baseQWatts (β ориентации × множитель угловой комнаты при layout=corner).
   */
  heatLossFactor?: number;
  /** Множитель угловой комнаты (1 или ~1.08), только wall/window при layout=corner. */
  cornerRoomFactor?: number;
  /** Температура среды за ограждением для ΔT (коридор ~15 °C для internal). */
  adjacentTempC?: number | null;
  qWatts: number;
  roomId?: string;
  roomName?: string;
  kind?: 'wall' | 'window' | 'ceiling' | 'floor' | 'roof' | null;
  count?: number | null;
  orientation?: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | null;
  openingWidthMm?: number | null;
  openingHeightMm?: number | null;
}

export interface HeatLossRoomReport {
  id: string;
  name: string;
  type: RoomType;
  areaM2: number;
  heightM: number;
  volumeM3: number;
  /** Потери через ограждения комнаты без kVent, Вт. */
  envelopeWatts: number;
  /** Множитель вентиляции (1.3 или 1.1) — единый на объект. */
  ventilationReserveFactor?: number;
  /** envelopeWatts × ventilationReserveFactor — нагрузка на котёл и радиатор, Вт. */
  designWatts?: number;
  elements: HeatLossElementReport[];
}

export interface HotWaterReport {
  objectType?: BuildingObjectType;
  residents?: number;
  fixtures?: HotWaterFixturesInput;
  /** Отметка «тропический душ» (накопительный сценарий). */
  tropicalShower?: boolean;
  /** Зима / лето для расчётной ХВ (+5 °C / +15 °C). */
  coldWaterDesignSeason?: 'winter' | 'summer';
  /**
   * Проточный (квартира): пик по расходу.
   * Накопительный (дом): котёл + БКН, мощность ГВС не от пролива.
   */
  dhwSupplyScenario?: 'flowThrough' | 'storage';
  /** Фактически использованная расчётная температура холодной воды в расчёте, °C (+5 зима / +15 лето). */
  designColdWaterC?: number;
  hotWaterC?: number;
  deltaTK?: number;
  /** Сумма расходов без учёта одновременности, л/с */
  sumFlowLpsRaw?: number;
  /** Применённый коэффициент одновременности (для пика расхода л/с) */
  simultaneityFactor?: number;
  /** Пиковый расход горячей воды, л/с */
  peakFlowLps?: number;
  /**
   * Тепловая мощность при пиковом «проливе», кВт (справочно для любого сценария).
   */
  peakThermalPowerKw?: number;
  /**
   * Мощность для подбора котла / контура ГВС: при проточном = peakThermalPowerKw;
   * при накопительном — max(24 кВт, мощность нагрева бака за storageHeatTimeMinutes).
   */
  hotWaterPowerKw?: number;
  /** Рекомендуемый объём накопителя, л (дом); для квартиры-проточки — 0. */
  recommendedTankLiters?: number;
  /** База литров на человека при расчёте бака (накопительный сценарий), обычно 45. */
  storageTankLitersPerPersonBasis?: number;
  /** Заданное время полного нагрева бака для оценки мощности БКН, мин. */
  storageHeatTimeMinutes?: number;
  /** Мощность нагрева объёма за storageHeatTimeMinutes до нижней отсечки 24 кВт, кВт. */
  storageIndirectHeatPowerKw?: number;
  /** Оценка литров за один сеанс смешения (~40–45 °C) по точкам водоразбора. */
  sessionDemandLitersMixed?: number;
  /** Эквивалентный минимальный объём бака при хранении после коэффициента замещения, л. */
  dhwEquivalentTankLitersFromSession?: number;
  /** Сырые литры до подгонки к типовому ряду: max(норма на человека, эквивалент сеанса), л. */
  dhwTankLitersCombinedRaw?: number;
  /** Версия справочника water_norms, использованная в расчёте. */
  normsSchemaVersion?: number;
  /** База β одновременности по типу объекта (справочно). */
  simultaneityBaseNorm?: number;
}

/** Подбор бойлера косвенного нагрева и связка с котлом (отчёт matching). */
export interface IndirectWaterHeaterMatchingReport {
  selected: import('../catalog/types').IndirectWaterHeaterCatalogItemNormalized | null;
  requiredTankLiters: number;
  /** Номинальная мощность теплообменника из каталога (specs.powerKw), кВт. */
  coilPowerKw: number | null;
  /** Оценка времени полного нагрева объёма при effectiveHeatPowerKw, мин. */
  heatTimeMinutesFullTank: number | null;
  /** min(номинал котла, мощность змеевика), кВт — для оценки времени нагрева. */
  effectiveHeatPowerKw: number | null;
  warnings: string[];
  /** Сообщения из справочника recommendations по code. */
  resolvedRecommendations?: import('../recommendations/types').ResolvedRecommendation[];
  /** Если подбор БКН не выполнялся — краткая причина. */
  skippedReason: string | null;
}

export interface HydraulicsReport {
  flowRateM3PerHour?: number;
  recommendedPipeDiameter?: string;
  recommendedVelocityRangeMPerSec?: [number, number];
  notes?: string[];
  inputs?: {
    heatLoadWatts: number;
    deltaTSystemK: number;
    mainLineLengthM: number;
  };
}

export interface EnvelopePreset {
  id: string;
  kind: EnvelopePresetKind;
  construction: string;
  material: string;
  description?: string;
  thicknessOptionsMm?: number[];
  uValue?: number;
  uModel?: EnvelopePresetUModel;
}

export interface MatchingReport {
  boiler?: BoilerMatchingReport;
  radiators?: RadiatorsMatchingReport;
  waterHeater?: WaterHeaterMatchingReport;
  indirectWaterHeater?: IndirectWaterHeaterMatchingReport;
}

export interface RadiatorsByRoomItem {
  roomId: string;
  roomName: string;
  /** Тепловтрати контуру приміщення (без запасу на інфільтрацію). */
  heatLossWatts: number;
  /** Нагрузка на подбор радиатора (Вт): designWatts − heatFluxUpWatts ТП в mixed или designWatts. */
  radiatorDesignWatts: number;
  radiatorModel: string;
  outputPerSectionWatts: number;
  sections: number | null;
  sectionsThermalMin?: number | null;
  windowOpeningWidthMm?: number | null;
  radiatorWidthMm?: number | null;
  widthCoverageRatio?: number | null;
  widthOk?: boolean | null;
  /** section — секции; panel — готовая панель из каталога. */
  priceBasis?: 'section' | 'panel';
  /** Длина панели, мм (только priceBasis=panel). */
  panelLengthMm?: number | null;
  warnings?: string[];
  sizingNotes?: string[];
}

export interface RadiatorsChosenSummary {
  model: string;
  material?: string;
  volumeLitersPerSection?: number;
  baseOutputWatts: number;
  baseDeltaT: 50 | 70;
  adjustedOutputWatts: number;
  targetDeltaT: number;
  sectionWidthMm?: number;
  priceBasis?: 'section' | 'panel';
}

/** Підбір радіаторів під лінію «Економ» або «Ефективний» (узгоджено з proposalEconomy / proposalEfficient). */
export interface RadiatorsProposalLineReport {
  tier: 'economy' | 'efficient';
  boilerModel: string | null;
  chosen: RadiatorsChosenSummary | null;
  byRoom: RadiatorsByRoomItem[];
  warnings: string[];
  /** Сума секцій по приміщеннях; null — немає даних. */
  totalSections: number | null;
  unavailableReason?: string;
  inputs?: {
    supplyC: number;
    returnC: number;
    insideC: number;
    baseDeltaT: 50 | 70;
    targetDeltaT: number;
    /** Множитель kVent (1.3 natural / 1.1 recuperation). */
    ventilationReserveFactor?: number;
    radiatorSizingAlignedWithCondensing?: boolean;
    heatingDistribution?: 'individual' | 'central';
    radiatorConnection?: 'side' | 'bottom';
    thermalRegimePreset?: HeatingThermalRegimePreset;
  };
  radiatorSelectionNotes?: string[];
}

export interface RadiatorsMatchingReport {
  chosen: RadiatorsChosenSummary | null;
  byRoom: RadiatorsByRoomItem[];
  warnings: string[];
  /** Лінія «Економ»: графік 75/65, секції під proposalEconomy. */
  lineEconomy?: RadiatorsProposalLineReport;
  /** Лінія «Еффективный»: графік 55/45, секції під proposalEfficient. */
  lineEfficient?: RadiatorsProposalLineReport;
  inputs?: {
    supplyC: number;
    returnC: number;
    insideC: number;
    baseDeltaT: 50 | 70;
    targetDeltaT: number;
    /** Множитель kVent (1.3 natural / 1.1 recuperation). */
    ventilationReserveFactor?: number;
    radiatorSizingAlignedWithCondensing?: boolean;
    heatingDistribution?: 'individual' | 'central';
    radiatorConnection?: 'side' | 'bottom';
    /** Фактично застосований пресет графіка (якщо був у запиті). */
    thermalRegimePreset?: HeatingThermalRegimePreset;
  };
  /** Пояснення щодо сімейства радіаторів / панельних моделей. */
  radiatorSelectionNotes?: string[];
}

export interface WaterHeaterChosenVariant {
  volumeLiters: number;
  /** Цена выбранного варианта (валюта — currency каталога). */
  price: number;
  powerKw?: number;
  /** Паспортное время полного нагрева для выбранного литража, мин (если задано в каталоге). */
  heatingTimeMinutes?: number;
}

export interface WaterHeaterMatchingReport {
  selected: import('../catalog/types').WaterHeaterCatalogItemNormalized | null;
  /** Конкретный типоразмер и цена после подбора. */
  chosenVariant: WaterHeaterChosenVariant | null;
  requiredTankLiters?: number;
  warnings: string[];
}

export interface MatchingAutomationHint {
  type: string;
  message: string;
  suggestedScheme?: HotWaterBoilerPowerMatchingScheme;
}

export interface CalcReport {
  meta: {
    schemaVersion: number;
    generatedAt: string;
    /** Источник каталога для подбора (файл или БД). */
    catalogSource: 'file' | 'mongo';
    /** Источник норм ГВС (water_norms). */
    waterNormsSource?: 'file' | 'mongo';
    waterNormsSchemaVersion?: number;
    /** Источник правил по типам техники (appliances). */
    appliancesSource?: 'file' | 'mongo';
    appliancesSchemaVersions?: Partial<
      Record<'indirect_water_heater' | 'boiler' | 'electric_storage' | 'radiator', number>
    >;
    /** Момент загрузки снимка configCache (catalog + water_norms + appliances), ISO 8601. */
    referenceBundleLoadedAt?: string;
    /** Подсказки автоматизации схемы котёл/ГВС для интерфейса (не меняют расчёт сами по себе). */
    automationHints?: MatchingAutomationHint[];
    /** Источник текстов recommendations. */
    recommendationsSource?: 'file' | 'mongo';
    /** Источник пресетов режимов ТП. */
    ufhPresetsSource?: 'file' | 'mongo';
    ufhPresetsSchemaVersion?: number;
  };
  /** Структурированные рекомендации/предупреждения из коллекции recommendations. */
  recommendations?: import('../recommendations/types').ResolvedRecommendation[];
  input: CalcRequestBody;
  climate: ClimateSnapshot | null;
  temps: {
    insideC: number;
    outsideC: number;
  };
  calculations: {
    heatLoss: HeatLossReport;
    hotWater: HotWaterReport;
    hydraulics: HydraulicsReport;
    /** Расчёт водяного ТП; null, если waterUnderfloorHeating выключен. */
    underfloorHeating?: UnderfloorHeatingReport | null;
  };
  matching: MatchingReport;
  warnings: string[];
}

/** Результат runCalculation() — нормализованный вход и отчёт. */
export interface IRunCalculationResult {
  input: CalcRequestBody;
  report: CalcReport;
}

export interface CalcOkResponse {
  ok: true;
  report: CalcReport;
}

/** KPI сохранённого расчёта (коллекция calculations). */
export interface CalculationSummary {
  heatLossKw?: number;
  hotWaterPowerKw?: number;
  boilerRequiredKw?: number;
  boilerModel?: string;
  insideTempC?: number;
  outsideTempC?: number;
  objectType?: BuildingObjectType;
  warningsCount?: number;
  generatedAt?: string;
}

export interface ProjectCreateBody {
  clientName: string;
  label?: string;
  /** Черновик анкеты с фронта (произвольный объект). */
  survey?: Record<string, unknown>;
}

export interface ProjectUpdateBody {
  clientName?: string;
  label?: string | null;
  survey?: Record<string, unknown>;
}

export interface ProjectListItem {
  id: string;
  clientName: string;
  label?: string;
  createdAt: string;
  updatedAt: string;
  calculationsCount?: number;
}

export interface ProjectDetail extends ProjectListItem {
  survey?: unknown;
  lastCalcInput?: CalcRequestBody;
  lastCalculation?: CalculationListItem;
}

export interface CalculationListItem {
  id: string;
  projectId: string;
  summary: CalculationSummary;
  createdAt: string;
}

export interface CalculationDetail extends CalculationListItem {
  calcInput: CalcRequestBody;
  report: CalcReport;
}

/** Тело POST .../projects/:id/calc — calcInput, корневой CalcInput или fallback lastCalcInput; опционально survey. */
export interface ProjectCalcBody extends CalcRequestBody {
  calcInput?: CalcRequestBody;
  survey?: Record<string, unknown>;
}

export interface ProjectsListResponse {
  ok: true;
  projects: ProjectListItem[];
  total: number;
  limit: number;
  skip: number;
}

export interface ProjectCreateResponse {
  ok: true;
  project: ProjectDetail;
}

export interface ProjectGetResponse {
  ok: true;
  project: ProjectDetail;
}

export interface ProjectUpdateResponse {
  ok: true;
  project: ProjectDetail;
}

export interface ProjectDeleteResponse {
  ok: true;
  deleted: true;
  calculationsRemoved: number;
}

export interface ProjectCalcResponse {
  ok: true;
  report: CalcReport;
  calculation: CalculationListItem;
  project: ProjectDetail;
}

export interface CalculationsListResponse {
  ok: true;
  calculations: CalculationListItem[];
  total: number;
  limit: number;
  skip: number;
}

export interface CalculationGetResponse {
  ok: true;
  calculation: CalculationDetail;
}

