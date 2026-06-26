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
  roughnessMmByMaterial: Record<string, number>;
  localLossZeta: {
    elbow90: number;
    teeBranch: number;
    mixingNode: number;
    collector: number;
  };
  pumpHeadMarginPercent: number;
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
  | 'dhw_load';

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

export interface HydraulicsPressureReport {
  criticalLoopEdgeIds: string[];
  headRequiredM: number;
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
  catalogPumpId: string;
  modeName: string;
  headMarginPercent: number;
  designFlowM3PerHour: number;
  headRequiredM: number;
  headAtDesignM: number;
  warnings: string[];
}

export interface HydraulicsMatchingReport {
  pipes: HydraulicsPipeMatchItem[];
  pump?: HydraulicsPumpMatch;
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
