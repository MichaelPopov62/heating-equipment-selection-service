/**
 * Назначение: типы каталога оборудования.
 * Описание: TypeScript-декларации для JS-модулей каталога (котлы, радиаторы, БКН, трубы, насосы);
 * не участвует в рантайме, обеспечивает строгую типизацию в редакторе.
 */
import type { BoilerCombustionType } from '../types/boiler-types';

export interface PowerRangeKw {
  max?: number;
  min?: number;
}

/**
 * Способ установки котла в каталоге (каталог / MongoDB / отчёт matching).
 * - `wall` — настенный
 * - `floor` — напольный
 * В JSON до нормализации допускаются синонимы и теги `wall-mounted` / `floor-standing` (см. validateCatalog.js).
 */
export type BoilerMountingType = 'wall' | 'floor';

export interface BoilerCatalogItem {
  model?: string;
  powerKw?: PowerRangeKw;
  /** Ориентировочная цена за единицу (валюта — metadata каталога, например UAH). */
  price?: number;
  mountingType?: BoilerMountingType;
  /** Диаметры присоединения (например условных рядов дюймов или DN). */
  connectionDiameters?: string[];
  circulationPump?: BoilerCirculationPumpNormalized;
}

export interface RadiatorCatalogItem {
  model?: string;
  outputWatts?: {
    deltaT50?: number;
    deltaT70?: number;
  };
  dimensions?: {
    height?: number;
    width?: number;
    depth?: number;
    interaxle?: number;
  };
}

/** Один типоразмер водонагревателя в каталоге: объём и своя цена. */
export interface WaterHeaterVariantNormalized {
  volumeLiters: number;
  price: number;
  /** Номинальная мощность ТЭН для этого литража, кВт (опционально). */
  powerKw?: number;
  /** Время полного нагрева по паспорту, мин (опционально). */
  heatingTimeMinutes?: number;
}

export interface WaterHeaterCatalogItem {
  model?: string;
  /** После валидации: `electric_storage` (при отсутствии в JSON подставляется по умолчанию). */
  type?: string;
  variants?: WaterHeaterVariantNormalized[];
  heatingElementType?: string;
  features?: string[];
  powerDetails?: string;
}

// Нормализованные типы (после validateAndNormalizeCatalog), которые используются в расчётах/подборе.
export interface PowerRangeKwNormalized {
  max: number;
  min: number;
}

export interface BoilerCatalogItemNormalized {
  model: string;
  powerKw: PowerRangeKwNormalized;
  fuel?: string;
  efficiencyPercent?: number;
  isDoubleCircuit: boolean;
  /** Сколько контуров (1 — секция singleCircuit, 2 — doubleCircuit). */
  circuitsCount: number;
  /** Турбированный или атмосферный. */
  combustionType?: BoilerCombustionType;
  /** Тип котла (нормализованная строка, например condensing / traditional). */
  type: string;
  tags?: string[];
  priceSegment?: string;
  gasConsumptionM3PerHour?: number;
  /** Ориентировочная цена за единицу; обязательна для каждой позиции в каталоге (валюта — metadata). */
  price: number;
  mountingType?: BoilerMountingType;
  connectionDiameters?: string[];
  /** Встроенный циркуляционный насос (кривая H(Q) — как у catalog.pumps). */
  circulationPump?: BoilerCirculationPumpNormalized;
}

/** Встроенный насос котла после validateAndNormalizeCatalog. */
export interface BoilerCirculationPumpNormalized {
  operatingModes: PumpOperatingModeNormalized[];
}

/** За что указана цена радиатора в каталоге (за секцию или за готовую панель указанного размера). */
export type RadiatorPriceBasis = 'section' | 'panel';

export interface RadiatorCatalogItemNormalized {
  model: string;
  outputWatts: {
    deltaT50: number;
    deltaT70: number;
  };
  material?: string;
  volumeLiters?: number;
  /** Цена в валюте каталога: за секцию или за панель целиком — см. priceBasis. */
  price: number;
  priceBasis: RadiatorPriceBasis;
  /**
   * Габариты секции радиатора (мм).
   * width используется как ширина одной секции для проверки правила 70% по окну.
   */
  dimensions?: {
    height?: number;
    width: number;
    depth?: number;
    interaxle?: number;
  };
  /**
   * Ширина одной секции (мм). Дублирует dimensions.width для удобства расчётов.
   * Для панели — длина прибора по каталогу (мм).
   */
  sectionWidthMm?: number;
}

export interface WaterHeaterCatalogItemNormalized {
  model: string;
  /** Накопительный электрический ВН (MVP каталога). */
  type: string;
  variants: WaterHeaterVariantNormalized[];
  heatingElementType?: string;
  /** Уточнение по ТЭН на уровне модели (например «2×1.2 кВт»). */
  powerDetails?: string;
  features?: string[];
}

/** Характеристики БКН в каталоге после validateAndNormalizeCatalog. */
export interface IndirectWaterHeaterSpecsNormalized {
  volumeLiters: number;
  powerKw?: number;
  surfaceAreaM2?: number;
  maxTempC?: number;
  heatingTimeMinutes?: number;
  standingLossKwh24h?: number;
  /** Минимальная рекомендуемая мощность источника (котёл/контур), кВт. */
  minSourcePowerKw?: number;
}

/** Тип номенклатуры БКН в каталоге: три независимых значения (не смешивать семантику). */
export type IndirectWaterHeaterMountType = 'indirect_wall' | 'indirect_floor' | 'storage_indirect';

/**
 * БКН после валидации каталога.
 * Расширяемые поля (brand, article, dimensions…) — как в test_data.json.
 */
export interface IndirectWaterHeaterCatalogItemNormalized extends Record<string, unknown> {
  model: string;
  /** Цена в валюте каталога (UAH). */
  price: number;
  /** Одно из допустимых значений классификации БКН в каталоге. */
  type: IndirectWaterHeaterMountType;
  specs: IndirectWaterHeaterSpecsNormalized;
}

/** Труба после validateAndNormalizeCatalog (контракт — PipeCatalogItem в OpenAPI). */
export interface PipeCatalogItemNormalized extends Record<string, unknown> {
  model: string;
  id: string;
  brand: string;
  material: string;
  diameter: number;
  wallThickness: number;
  price: number;
  category?: string;
}

export type PumpCatalogSegment = 'premium' | 'medium' | 'budget';

export type PumpCatalogType = 'electronic' | 'three_speed' | 'circulation_hot_water';

export interface PumpOperatingModeCoefficients {
  a: number;
  b: number;
  c: number;
}

export interface PumpOperatingModeNormalized {
  modeName: string;
  speedIndex: number;
  powerWatts: number;
  coefficients: PumpOperatingModeCoefficients;
  qMinM3h: number;
  qMaxM3h: number;
}

export interface PumpConnectionsNormalized {
  mountingLengthMm: number;
  threadInch: string;
  nominalDiameterMm: number;
}

/** Насос после validateAndNormalizeCatalog (контракт — PumpCatalogItem в OpenAPI). */
export interface PumpCatalogItemNormalized extends Record<string, unknown> {
  model: string;
  id: string;
  brand: string;
  series?: string;
  segment: PumpCatalogSegment;
  country?: string;
  type: PumpCatalogType;
  price: number;
  connections: PumpConnectionsNormalized;
  operatingModes: PumpOperatingModeNormalized[];
}

/** Назначение коллектора в каталоге. */
export type ManifoldApplication = 'radiator' | 'underfloor';

export interface ManifoldDimensionsNormalized {
  width: number;
  height: number;
  depth: number;
}

/** Коллектор (ТП / радиаторы) после validateAndNormalizeCatalog. */
export interface ManifoldCatalogItemNormalized extends Record<string, unknown> {
  model: string;
  brand: string;
  article: string;
  price: number;
  outletsCount: number;
  manifoldApplication: ManifoldApplication;
  hasFlowMeters: boolean;
  material: string;
  maxPressureBar: number;
  maxTemperatureC: number;
  connectionMainInch: string;
  connectionOutletsInch: string;
  dimensions: ManifoldDimensionsNormalized;
}

export interface BoilerManifoldDimensionsNormalized {
  width: number;
  height: number;
  depth: number;
}

/** Котельный коллектор после validateAndNormalizeCatalog. */
export interface BoilerManifoldCatalogItemNormalized extends Record<string, unknown> {
  model: string;
  brand: string;
  article: string;
  price: number;
  circuitsCount: number;
  maxPowerKw: number;
  hasInsulation: boolean;
  interaxleDistanceMm: number;
  connectionBoilerInch: string;
  connectionCircuitsInch: string;
  maxPressureBar: number;
  maxTemperatureC: number;
  material: string;
  dimensions: BoilerManifoldDimensionsNormalized;
}

export interface NormalizedCatalog {
  boilers: {
    doubleCircuit: BoilerCatalogItemNormalized[];
    singleCircuit: BoilerCatalogItemNormalized[];
  };
  radiators: RadiatorCatalogItemNormalized[];
  waterHeaters: WaterHeaterCatalogItemNormalized[];
  /** Трубы после validateAndNormalizeCatalog (обязательные поля — PipeCatalogItem). */
  pipes?: PipeCatalogItemNormalized[];
  /** Циркуляционные насосы после validateAndNormalizeCatalog. */
  pumps?: PumpCatalogItemNormalized[];
  /** Бойлеры косвенного нагрева (БКН), после валидации. */
  indirectWaterHeaters?: IndirectWaterHeaterCatalogItemNormalized[];
  /** Коллекторы ТП / радиаторов. */
  manifolds?: ManifoldCatalogItemNormalized[];
  /** Котельные распределительные коллекторы. */
  boilerManifolds?: BoilerManifoldCatalogItemNormalized[];
}

