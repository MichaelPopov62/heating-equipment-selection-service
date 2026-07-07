/**
 * Назначение: типы гидравлической проверки петли ТП.
 */

export type UfhLoopPipeResizeAction =
  | 'unchanged'
  | 'upsized'
  | 'downsized'
  | 'loops_adjusted';

export type UfhLoopResolutionStatus =
  | 'resolved_auto'
  | 'unresolved_velocity'
  | 'unresolved_pressure'
  | 'unresolved_conflict';

export type UfhLoopAppliedFix =
  | 'none'
  | 'loops_reduced'
  | 'loops_increased'
  | 'pipe_downsized'
  | 'pipe_upsized';

export interface UfhLoopPipeCandidate {
  catalogPipeId: string;
  internalDiameterMm: number;
  velocityMps: number;
  pressureDropKPa: number;
  pipe: import('../catalog/types').PipeCatalogItemNormalized;
}

export interface UfhLoopHydraulicsResult {
  loopId: string;
  loopLengthM: number;
  pipeSpacingMm: number;
  heatLoadWatts: number;
  deltaTK: number;
  flowRateM3PerHour: number;
  massFlowKgPerSec: number;
  elbowCount: number;
  localZeta: number;
  catalogPipeId: string | null;
  /** Ø до оптимизации (минимальный из каталога). */
  initialCatalogPipeId: string | null;
  internalDiameterMm: number | null;
  velocityMps: number | null;
  pressureDropKPa: number | null;
  pipeResizeAction: UfhLoopPipeResizeAction;
  pipeResizeReason: string | null;
  warnings: string[];
}

export interface UfhRoomLoopsHydraulicsResult {
  loopsCount: number;
  loops: import('../hydraulics/types').HydraulicsUfhLoop[];
  loopHydraulics: UfhLoopHydraulicsResult[];
  warnings: string[];
  pipeResizeApplied: boolean;
  resolutionStatus: UfhLoopResolutionStatus;
  appliedFix: UfhLoopAppliedFix;
  minLoopsGeom: number;
  chosenLoopsCount: number;
}
