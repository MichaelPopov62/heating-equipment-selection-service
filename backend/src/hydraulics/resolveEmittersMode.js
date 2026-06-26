/**
 * Назначение: определение режима emitters для pipeline DTO.
 * Описание: radiators_only | ufh_only | mixed из heatingSystem и отчёта ТП.
 */

/**
 * @param {import('../types/shared-types').HeatingSystemInput | undefined | null} heatingSystem
 * @param {import('../types/shared-types').UnderfloorHeatingReport | null | undefined} underfloorHeating
 * @returns {import('./types').HydraulicsEmittersMode}
 */
export function resolvePipelineEmittersMode(heatingSystem, underfloorHeating) {
  const hsMode = heatingSystem?.heatingEmittersMode;
  if (hsMode === 'ufh_only') return 'ufh_only';

  const hasUfh = (underfloorHeating?.rooms?.length ?? 0) > 0;
  const hasRadiators = hsMode !== 'ufh_only';

  if (hasUfh && hasRadiators) return 'mixed';
  if (hasUfh) return 'ufh_only';

  return 'radiators_only';
}

/**
 * @param {import('./types').HydraulicsApplianceRules} hydraulicsRules
 * @returns {import('./types').HydraulicsRules}
 */
export function hydraulicsRulesFromAppliance(hydraulicsRules) {
  return {
    velocityLimitsMps: { ...hydraulicsRules.velocityLimitsMps },
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
