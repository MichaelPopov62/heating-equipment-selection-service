/**
 * Назначение: типы Pure Pipeline гидравлики.
 * Описание: DTO входа, граф, отчёт и matching — JSDoc import('../hydraulics/types').
 */

import type { HotWaterBoilerPowerMatchingScheme } from '../types/boiler-types';
import type { BuildingObjectType } from '../types/shared-types';

export type HydraulicsEmittersMode = 'radiators_only' | 'ufh_only' | 'mixed';

export type HydraulicsFluid = 'heating' | 'water';

export type HydraulicsPipeMaterialPreference = 'pex' | 'metal_plastic' | 'steel';

export interface HydraulicsSurveyInput {
  mainLineLengthM?: number;
  deltaTSystemK?: number;
  pipeMaterialPreference?: HydraulicsPipeMaterialPreference;
}

export interface HydraulicsVelocityLimits {
  mainMax: number;
  branchMax: number;
  mainMin: number;
}

export interface HydraulicsDefaultLengthsM {
  mainLine: number;
  radiatorBranch: number;
  ufhCollectorBranch: number;
}

export interface HydraulicsApplianceRules {
  applianceKind: 'hydraulics';
  schemaVersion: number;
  label: string;
  velocityLimitsMps: HydraulicsVelocityLimits;
  defaultLengthsM: HydraulicsDefaultLengthsM;
  maxUfhLoopLengthM: number;
  ufhLoopDeltaTK: number;
  ufhLoopVelocityMinMps: number;
  ufhLoopVelocityMaxMps: number;
  maxUfhLoopPressureDropKPa: number;
  ufhLoopMinNominalDiameterMm: number;
  ufhParasiticDownTriggerWm2: number;
  ufhParasiticDownToUpRatio: number;
  ufhLoopPipeResizeEnabled: boolean;
  ufhLoopPressureUtilizationForResize: number;
  roughnessMmByMaterial: Record<string, number>;
  localLossZeta: {
    elbow90: number;
    teeBranch: number;
    mixingNode: number;
    collector: number;
  };
  pumpHeadMarginPercent: number;
  pumpDutyQMaxUtilizationPercent: number;
  pumpMinHeadAtDutyM: number;
  pumpMaxHeadMarginPercent: number;
  pumpMinHeadAtQMaxM: number;
  primaryFlowMarginPercent: number;
  balancingValveKPaPerTurn: number;
}

export interface HydraulicsSourceNode {
  catalogBoilerId?: string;
  supplyC: number;
  returnC: number;
  deltaTK: number;
  requiredKw: number;
  connectionNominalMm: number[];
  mountingType?: 'wall' | 'floor';
}

export interface HydraulicsRadiatorConsumer {
  roomId: string;
  roomName: string;
  floor: number;
  heatLoadWatts: number;
  flowRateM3PerHour: number;
}

export interface HydraulicsRadiatorsCircuit {
  thermalRegime: { supplyC: number; returnC: number; deltaTK: number };
  connectionType: 'side' | 'bottom';
  consumers: HydraulicsRadiatorConsumer[];
  totalFlowRateM3PerHour: number;
}

export interface HydraulicsUfhLoop {
  loopId: string;
  estimatedLengthM: number;
  heatLoadWatts: number;
  flowRateM3PerHour: number;
  /** Подобранный Ø из ufhLoopHydraulics — для pipeline без повторного pickPipe. */
  catalogPipeId?: string;
}

export interface HydraulicsUfhRoom {
  roomId: string;
  roomName: string;
  floor: number;
  areaM2: number;
  pipeSpacingMm: number;
  circuitSupplyC: number;
  circuitReturnC: number;
  heatLoadWatts: number;
  flowRateM3PerHour: number;
  loopsCount?: number;
  loops?: HydraulicsUfhLoop[];
}

export interface HydraulicsMixingNodeSnapshot {
  flowRateM3PerHour: number;
  headMetersMin: number;
  valveKvsMin: number;
  boilerSupplyC?: number;
  floorCircuitSupplyC?: number;
}

export interface HydraulicsUnderfloorCircuit {
  deltaTK: number;
  aggregate: { heatLoadWatts: number; flowRateM3PerHour: number };
  isMixingNodeRequired: boolean;
  distributionPreset?: 'collector_mixing_valve' | 'hydraulic_separator';
  mixingNode?: HydraulicsMixingNodeSnapshot;
  rooms: HydraulicsUfhRoom[];
}

export interface HydraulicsDhwIndirectTank {
  volumeLiters: number;
  coilPowerKw: number;
}

export interface HydraulicsDhwCircuit {
  scenario: 'flowThrough' | 'storage';
  peakFlowLps: number;
  hotWaterPowerKw: number;
  designColdWaterC?: number;
  hotWaterC?: number;
  indirectTank?: HydraulicsDhwIndirectTank;
}

export interface HydraulicsCircuits {
  radiators?: HydraulicsRadiatorsCircuit;
  underfloor?: HydraulicsUnderfloorCircuit;
  dhw?: HydraulicsDhwCircuit;
}

export interface HydraulicsBranchLayout {
  roomId: string;
  estimatedLengthM: number;
}

export interface HydraulicsLayout {
  mainLineLengthM: number;
  radiatorBranches: HydraulicsBranchLayout[];
  ufhBranches: HydraulicsBranchLayout[];
  pipeMaterialPreference?: HydraulicsPipeMaterialPreference;
}

export interface HydraulicsRules {
  velocityLimitsMps: HydraulicsVelocityLimits;
  defaultLengthsM: HydraulicsDefaultLengthsM;
  maxUfhLoopLengthM: number;
  roughnessMmByMaterial: Record<string, number>;
  localLossZeta: HydraulicsApplianceRules['localLossZeta'];
  pumpHeadMarginPercent: number;
  pumpDutyQMaxUtilizationPercent: number;
  pumpMinHeadAtDutyM: number;
  pumpMaxHeadMarginPercent: number;
  pumpMinHeadAtQMaxM: number;
  primaryFlowMarginPercent: number;
  balancingValveKPaPerTurn: number;
}

/** Пороги допустимой рабочей точки насоса (подмножество HydraulicsRules). */
export interface HydraulicsPumpDutyRules {
  pumpHeadMarginPercent: number;
  pumpDutyQMaxUtilizationPercent: number;
  pumpMinHeadAtDutyM: number;
  pumpMaxHeadMarginPercent: number;
}

export type HydraulicsCirculationTopology =
  | 'direct'
  | 'mixing_valve'
  | 'hydraulic_separator';

export type HydraulicsPumpRole = 'main' | 'zone' | 'dhw';

export type HydraulicsPumpSource = 'catalog' | 'boiler_builtin';

export interface HydraulicsCirculationZone {
  zoneId: string;
  label: string;
  pumpRole: HydraulicsPumpRole;
  designFlowM3PerHour: number;
  heatLoadWatts?: number;
  deltaTK: number;
  requiresCatalogPump: boolean;
  simultaneousWithHeating?: boolean;
  heatingFlowM3PerHour?: number;
  dhwPriorityFlowM3PerHour?: number;
}

export interface HydraulicsCirculationFlowsResult {
  zones: HydraulicsCirculationZone[];
  topology: HydraulicsCirculationTopology;
  primaryMainLineFlowM3PerHour: number;
  boilerPumpDesignFlowM3PerHour: number;
  mixingNodePrimaryBleedM3PerHour: number;
  notes: string[];
  warnings: string[];
}

export interface HydraulicsResolvedPump {
  zoneId: string;
  zoneLabel: string;
  pumpRole: HydraulicsPumpRole;
  pumpSource: HydraulicsPumpSource;
  catalogPumpId?: string;
  catalogBoilerId?: string;
  modeName: string;
  headMarginPercent: number;
  designFlowM3PerHour: number;
  headRequiredM: number;
  headAtDesignM: number;
  note?: string;
  warnings: string[];
}

export interface HydraulicsSystemPumpsResult {
  circulationZones: HydraulicsCirculationZone[];
  topology: HydraulicsCirculationTopology;
  boilerPumpDesignFlowM3PerHour: number;
  primaryMainLineFlowM3PerHour: number;
  pumps: HydraulicsResolvedPump[];
  pump?: HydraulicsPumpMatch;
  warnings: string[];
  notes: string[];
}

export interface HydraulicsPipelineInput {
  schemaVersion: 1;
  meta: {
    heatingEmittersMode: HydraulicsEmittersMode;
    objectType: BuildingObjectType;
    dhwMatchingScheme: HotWaterBoilerPowerMatchingScheme;
  };
  source: HydraulicsSourceNode;
  circuits: HydraulicsCircuits;
  layout: HydraulicsLayout;
  rules: HydraulicsRules;
}

export type HydraulicsNodeKind =
  | 'boiler'
  | 'hydraulic_separator'
  | 'mixing_node'
  | 'main_collector'
  | 'ufh_collector'
  | 'radiator_consumer'
  | 'ufh_loop'
  | 'dhw_load'
  | 'indirect_coil';

export type HydraulicsCirculationCircuitKind =
  | 'radiators'
  | 'underfloor'
  | 'dhw'
  | 'indirect_dhw';

export interface HydraulicsGraphNode {
  id: string;
  kind: HydraulicsNodeKind;
  label: string;
  roomId?: string;
  loopId?: string;
}

export interface HydraulicsGraphEdge {
  id: string;
  from: string;
  to: string;
  lengthM: number;
  fluid: HydraulicsFluid;
  designFlowM3PerHour: number;
  supplyC?: number;
  returnC?: number;
  segmentRole: 'main' | 'branch' | 'ufh_loop' | 'dhw';
  /** Предпочтительная труба из расчёта петли ТП (ufhLoopHydraulics). */
  preferredCatalogPipeId?: string;
}

export interface HydraulicsGraph {
  nodes: HydraulicsGraphNode[];
  edges: HydraulicsGraphEdge[];
}

export interface HydraulicsConsumerSummary {
  circuit: 'radiators' | 'underfloor' | 'dhw';
  totalFlowRateM3PerHour: number;
  totalHeatLoadWatts?: number;
}

export interface HydraulicsPressureSegment {
  edgeId: string;
  lengthM: number;
  velocityMps: number;
  pressureDropKPa: number;
  catalogPipeId?: string;
}

export interface HydraulicsCirculationLoopBranch {
  branchId: string;
  label: string;
  circuit: HydraulicsCirculationCircuitKind;
  roomId?: string;
  loopId?: string;
  edgeIds: string[];
  pressureDropKPa: number;
  isCritical: boolean;
}

export interface HydraulicsBalancingRecommendation {
  branchId: string;
  label: string;
  circuit: HydraulicsCirculationCircuitKind;
  branchPressureDropKPa: number;
  criticalPressureDropKPa: number;
  excessPressureDropKPa: number;
  estimatedValveTurns?: number;
  hint: string;
}

export interface HydraulicsPressureReport {
  criticalLoopEdgeIds: string[];
  headRequiredM: number;
  criticalPressureDropKPa?: number;
  criticalLoop?: HydraulicsCirculationLoopBranch;
  circulationLoops?: HydraulicsCirculationLoopBranch[];
  balancingRecommendations?: HydraulicsBalancingRecommendation[];
  segments: HydraulicsPressureSegment[];
}

export interface HydraulicsPipeMatchItem {
  edgeId: string;
  catalogPipeId: string;
  velocityMps: number;
  pressureDropKPa: number;
  internalDiameterMm: number;
}

export interface HydraulicsPumpMatch {
  zoneId?: string;
  zoneLabel?: string;
  pumpRole?: HydraulicsPumpRole;
  pumpSource?: HydraulicsPumpSource;
  catalogPumpId?: string;
  catalogBoilerId?: string;
  modeName: string;
  headMarginPercent: number;
  designFlowM3PerHour: number;
  headRequiredM: number;
  headAtDesignM: number;
  note?: string;
  warnings: string[];
}

export interface HydraulicsPipeProposalLine {
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
}

export interface HydraulicsPipeLineGroup {
  circuitId: 'heating' | 'ufh';
  label: string;
  pipeLines: HydraulicsPipeProposalLine[];
  estimatedPrice: number;
}

export interface HydraulicsPipeSegmentProposal {
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
}

export interface HydraulicsPumpProposal {
  zoneId: string;
  zoneLabel: string;
  pumpRole: HydraulicsPumpRole;
  pumpSource: HydraulicsPumpSource;
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
}

export interface HydraulicsProposalReport {
  designFlowM3PerHour: number;
  headRequiredM: number;
  topology?: HydraulicsCirculationTopology;
  circulationZones?: HydraulicsCirculationZone[];
  pipeLines: HydraulicsPipeProposalLine[];
  pipeLineGroups?: HydraulicsPipeLineGroup[];
  pipeSegments: HydraulicsPipeSegmentProposal[];
  pump?: HydraulicsPumpProposal;
  pumps?: HydraulicsPumpProposal[];
  estimatedPipesPrice: number;
  estimatedPumpPrice: number;
  estimatedTotalPrice: number;
  unavailableReason?: string;
  pumpUnavailableReason?: string;
}

export interface HydraulicsMatchingReport {
  pipes: HydraulicsPipeMatchItem[];
  topology?: HydraulicsCirculationTopology;
  circulationZones?: HydraulicsCirculationZone[];
  pump?: HydraulicsPumpMatch;
  pumps?: HydraulicsPumpMatch[];
  proposal?: HydraulicsProposalReport;
  warnings: string[];
}

export interface HydraulicsReport {
  schemaVersion: 1;
  inputs?: {
    heatLoadWatts: number;
    deltaTSystemK: number;
    mainLineLengthM: number;
  };
  massFlowKgPerSec?: number;
  flowRateM3PerHour?: number;
  boilerPumpDesignFlowM3PerHour?: number;
  circulationTopology?: HydraulicsCirculationTopology;
  recommendedPipeDiameter?: string;
  recommendedVelocityRangeMPerSec?: [number, number];
  consumers?: HydraulicsConsumerSummary[];
  graph?: HydraulicsGraph;
  pressure?: HydraulicsPressureReport;
  notes?: string[];
}

export interface HydraulicsPipelineResult {
  hydraulics: HydraulicsReport;
  hydraulicsMatching: HydraulicsMatchingReport;
}
