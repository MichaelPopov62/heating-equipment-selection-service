/**
 * Назначение: Типы номенклатуры каталога для UI и будущего подбора в смете.
 * Описание: Зеркало ManifoldCatalogItem / BoilerManifoldCatalogItem после validateCatalog на backend.
 */

/** Назначение коллектора в системе отопления. */
export type ManifoldApplication = 'radiator' | 'underfloor';

/** Габариты коллектора, мм. */
export type CatalogManifoldDimensions = {
  width: number;
  height: number;
  depth: number;
};

/** Коллектор ТП / радиаторов из GET /api/v1/catalog → catalog.manifolds. */
export type CatalogManifoldItem = {
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
  dimensions: CatalogManifoldDimensions;
};

/** Котельный распределительный коллектор из catalog.boilerManifolds. */
export type CatalogBoilerManifoldItem = {
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
  dimensions: CatalogManifoldDimensions;
};

/** Конструкция унибокса. */
export type UniboxType =
  | 'rtl_air'
  | 'rtl'
  | 'rtl_afc'
  | 'balancing_valve'
  | 'air_only';

export type UniboxConnectionThread = 'G1/2' | 'G3/4';
export type UniboxConnectionFit = 'eurocone' | 'internal_thread';

/** Унибокс из GET /api/v1/catalog → catalog.uniboxes. */
export type CatalogUniboxItem = {
  id: string;
  brand: string;
  model: string;
  type: UniboxType;
  loopsCount: number;
  maxAreaSqM: number;
  maxLoopLengthM: number;
  maxTemperatureC: number;
  maxPressureBar: number;
  kvM3h: number;
  connection: { thread: UniboxConnectionThread; fit: UniboxConnectionFit };
  material: string;
  price: number;
  minAirTempC?: number;
  maxAirTempC?: number;
  minCoolantTempC?: number;
  maxCoolantTempC?: number;
  minFlowLph?: number;
  maxFlowLph?: number;
  maxSupplyTempC?: number;
  dimensions?: CatalogManifoldDimensions;
  description?: string;
};
