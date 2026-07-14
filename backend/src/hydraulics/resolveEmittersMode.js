/**
 * Назначение: определение режима emitters для pipeline DTO.
 * Описание: radiators_only | ufh_only | mixed из heatingSystem и отчёта ТП.
 */

/**
 * @param {import('../types/shared-types.js').HeatingSystemInput | undefined | null} heatingSystem
 * @param {import('../types/shared-types.js').UnderfloorHeatingReport | null | undefined} underfloorHeating
 * @returns {import('./types.js').HydraulicsEmittersMode}
 */
export function resolvePipelineEmittersMode(heatingSystem, underfloorHeating) {
  const hsMode = heatingSystem?.heatingEmittersMode;
  if (hsMode === 'ufh_only') return 'ufh_only';

  const hasUfh = (underfloorHeating?.rooms?.length ?? 0) > 0;
  // Після early-return для ufh_only режим анкети — радіатори (або не заданий).
  if (hasUfh) return 'mixed';
  return 'radiators_only';
}

/**
 * @param {import('./types.js').HydraulicsApplianceRules} hydraulicsRules
 * @returns {import('./types.js').HydraulicsRules}
 */
export function hydraulicsRulesFromAppliance(hydraulicsRules) {
  const vel = hydraulicsRules.velocityLimitsMps;
  const grouping = hydraulicsRules.radiatorBranchGrouping ?? {
    minFlowM3PerHourForIndividualBranch: 0.019,
    minHeatLoadWattsForIndividualBranch: 150,
    manifoldTrunkLengthM: 2,
    localZetaManifold: 1.5,
  };
  return {
    mainTransitMinInternalDiameterMm:
      hydraulicsRules.mainTransitMinInternalDiameterMm ?? 20,
    branchMinInternalDiameterMm:
      hydraulicsRules.branchMinInternalDiameterMm ?? 12,
    velocityLimitsMps: {
      mainMax: vel.mainMax,
      branchMax: vel.branchMax,
      mainMin: vel.mainMin,
      branchMin: vel.branchMin ?? 0,
    },
    radiatorBranchGrouping: { ...grouping },
    defaultLengthsM: { ...hydraulicsRules.defaultLengthsM },
    maxUfhLoopLengthM: hydraulicsRules.maxUfhLoopLengthM,
    roughnessMmByMaterial: { ...hydraulicsRules.roughnessMmByMaterial },
    localLossZeta: { ...hydraulicsRules.localLossZeta },
    pumpHeadMarginPercent: hydraulicsRules.pumpHeadMarginPercent,
    pumpDutyQMaxUtilizationPercent: hydraulicsRules.pumpDutyQMaxUtilizationPercent,
    pumpMinHeadAtDutyM: hydraulicsRules.pumpMinHeadAtDutyM,
    pumpMaxHeadMarginPercent: hydraulicsRules.pumpMaxHeadMarginPercent,
    pumpMinHeadAtQMaxM: hydraulicsRules.pumpMinHeadAtQMaxM,
    primaryFlowMarginPercent: hydraulicsRules.primaryFlowMarginPercent,
    balancingValveKPaPerTurn: hydraulicsRules.balancingValveKPaPerTurn,
  };
}

/**
 * @param {number} floor
 * @param {number} baseLengthM
 * @returns {number}
 */
export function estimateBranchLengthM(floor, baseLengthM) {
  const f = Number(floor) || 1;
  return Math.round(baseLengthM * (0.75 + (f - 1) * 0.35) * 10) / 10;
}
