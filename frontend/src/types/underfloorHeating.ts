/**
 * Назначение: Типы справочника и отчёта водяного тёплого пола (base + finish).
 */

import type { UfhDistributionPreset } from './ufhDistribution';

export type UfhPipeSpacingMm = 100 | 150 | 200;

export const UFH_PIPE_SPACING_OPTIONS: readonly UfhPipeSpacingMm[] = [100, 150, 200];

export const DEFAULT_UFH_PIPE_SPACING_MM: UfhPipeSpacingMm = 150;

export type UfhCircuitPresetId = 'ufh_dt10_45_35' | 'ufh_dt10_40_30';

export type FlooringFinishMaterial = {
  id: string;
  name: string;
  thicknessM: number;
  thermalConductivityWmK: number;
  maxSurfaceTemperatureCelsius: number;
  comfortMaxSurfaceTemperatureCelsius?: number;
  defaultUfhCircuitPresetId?: UfhCircuitPresetId;
  notes?: string;
};

export type UnderfloorHeatingBasePreset = {
  id: string;
  name: string;
  description?: string;
  usage: 'underfloor_heating_base';
  bottomBoundary?: 'heated' | 'unheated';
  baseCoveringResistanceM2KW: number;
  layers?: unknown[];
};

export type UnderfloorHeatingPresetsBundle = {
  bases: UnderfloorHeatingBasePreset[];
  finishes: FlooringFinishMaterial[];
};

export type ParsedUnderfloorHeatingRoom = {
  roomId: string;
  roomName: string;
  basePresetName: string;
  finishMaterialName: string;
  heatFluxUpWm2: number;
  heatFluxDownWm2: number;
  maxAllowableHeatFluxUpWm2: number;
  heatFluxUpWatts: number;
  heatFluxDownWatts: number;
  surfaceTempC: number;
  maxSurfaceTemperatureCelsius: number;
  comfortMaxSurfaceTemperatureCelsius: number | null;
  finishMaxSurfaceTemperatureCelsius?: number;
  presetMaxSurfaceTemperatureCelsius?: number;
  pipeSpacingMm: number;
  pipeEmbedmentResistanceM2KW: number;
  finishCoveringResistanceM2KW: number;
  coveringResistanceM2KW: number;
  warnings: string[];
};

export type ParsedUfhMixingNodeSpec = {
  boilerSupplyC: number | null;
  floorCircuitSupplyC: number | null;
  deltaTK: number | null;
  flowRateM3PerHour: number | null;
  headMetersMin: number | null;
  valveKvsMin: number | null;
  distributionPreset: Exclude<UfhDistributionPreset, 'auto'> | null;
  notes: string[];
};

export type ParsedUnderfloorHydraulics = {
  deltaTK: number;
  massFlowKgPerSec: number;
  flowRateM3PerHour: number;
};

export type ParsedUnderfloorHeating = {
  circuitSupplyC: number;
  circuitReturnC: number;
  circuitMeanC: number;
  circuitSource: 'heatingSystem' | 'mixed_default' | 'finish_preset' | 'ufh_mode_preset';
  isMixingNodeRequired: boolean;
  distributionPreset: Exclude<UfhDistributionPreset, 'auto'> | null;
  mixingNode: ParsedUfhMixingNodeSpec | null;
  underfloorHydraulics: ParsedUnderfloorHydraulics | null;
  rooms: ParsedUnderfloorHeatingRoom[];
  totalHeatFluxUpWatts: number;
  totalHeatFluxDownWatts: number;
  warnings: string[];
};
