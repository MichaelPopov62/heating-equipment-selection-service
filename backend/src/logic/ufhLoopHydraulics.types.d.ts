/**
 * Назначение: типы гидравлической проверки петли ТП.
 */

export interface UfhLoopHydraulicsResult {
  loopId: string;
  lengthM: number;
  pipeSpacingMm: number;
  heatLoadWatts: number;
  deltaTK: number;
  flowRateM3PerHour: number;
  massFlowKgPerSec: number;
  elbowCount: number;
  localZeta: number;
  catalogPipeId: string | null;
  internalDiameterMm: number | null;
  velocityMps: number | null;
  pressureDropKPa: number | null;
  warnings: string[];
}
