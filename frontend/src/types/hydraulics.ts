/**
 * Назначение: типы формы шага «Гидравлика» и предложения из отчёта API.
 */

export type HydraulicsPipeMaterialPreference = 'pex' | 'metal_plastic' | 'steel';

export type HydraulicsFormValue = {
  mainLineLengthM: number;
  deltaTSystemK: number;
  pipeMaterialPreference: HydraulicsPipeMaterialPreference | '';
};

export const DEFAULT_HYDRAULICS_FORM: HydraulicsFormValue = {
  mainLineLengthM: 8,
  deltaTSystemK: 20,
  pipeMaterialPreference: '',
};

export type ParsedHydraulicsPipeLine = {
  catalogPipeId: string;
  brand: string;
  model: string;
  material: string;
  outerDiameterMm: number;
  wallThicknessMm: number;
  internalDiameterMm: number;
  totalLengthM: number;
  edgeCount: number;
  pricePerMeter: number;
  linePrice: number;
};

export type ParsedHydraulicsPipeLineGroup = {
  circuitId: 'heating' | 'ufh';
  label: string;
  pipeLines: ParsedHydraulicsPipeLine[];
  estimatedPrice: number;
};

export type ParsedHydraulicsPipeSegment = {
  edgeId: string;
  segmentLabel: string;
  segmentRole: 'main' | 'branch' | 'ufh_loop' | 'dhw';
  lengthM: number;
  catalogPipeId: string;
  brand: string;
  model: string;
  material: string;
  outerDiameterMm: number;
  wallThicknessMm: number;
  internalDiameterMm: number;
  velocityMps: number;
  pressureDropKPa: number;
  pricePerMeter: number;
  linePrice: number;
  velocityLimitExceeded?: boolean;
};

export type ParsedHydraulicsPumpProposal = {
  zoneId: string;
  zoneLabel: string;
  pumpRole: 'main' | 'zone' | 'dhw';
  pumpSource: 'catalog' | 'boiler_builtin';
  catalogPumpId?: string;
  catalogBoilerId?: string;
  brand: string;
  model: string;
  segment?: 'premium' | 'medium' | 'budget';
  price: number;
  modeName: string;
  headAtDesignM: number;
  headRequiredM: number;
  designFlowM3PerHour: number;
  headMarginPercent: number;
  connectionNominalMm?: number;
  note?: string;
};

export type ParsedHydraulicsProposal = {
  designFlowM3PerHour: number;
  headRequiredM: number;
  topology?: 'direct' | 'mixing_valve' | 'hydraulic_separator';
  pipeLines: ParsedHydraulicsPipeLine[];
  pipeLineGroups: ParsedHydraulicsPipeLineGroup[];
  pipeSegments: ParsedHydraulicsPipeSegment[];
  pump: ParsedHydraulicsPumpProposal | null;
  pumps: ParsedHydraulicsPumpProposal[];
  estimatedPipesPrice: number;
  estimatedPumpPrice: number;
  estimatedTotalPrice: number;
  unavailableReason: string | null;
  pumpUnavailableReason: string | null;
  warnings: string[];
  hasCatalogSelection: boolean;
  hasPipeSelection: boolean;
};

/** Расчётные показатели из report.calculations.hydraulics (без подбора каталога). */
export type ParsedHydraulicsCalculations = {
  flowRateM3PerHour: number;
  headRequiredM: number;
  deltaTSystemK: number | null;
  mainLineLengthM: number | null;
  recommendedPipeDiameter: string | null;
  notes: string[];
};

/** Контекст ΔT: график радиаторов vs ΔT для расчёта расхода. */
export type ParsedHydraulicsFlowContext = {
  supplyC: number | null;
  returnC: number | null;
  thermalRegimeDeltaTK: number | null;
  flowDeltaTK: number | null;
};

/** Сводка гидравлики для UI: proposal + calculations + предупреждения matching. */
export type ParsedHydraulicsView = {
  proposal: ParsedHydraulicsProposal | null;
  calculations: ParsedHydraulicsCalculations | null;
  flowContext: ParsedHydraulicsFlowContext | null;
  matchingWarnings: string[];
  hasData: boolean;
};
