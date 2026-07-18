/**
 * Призначення: агрегація довжин ділянок гідравліки за призначенням.
 * Опис: Магістраль (main/trunk) vs підводи від колектора (branch) — для summary UI.
 */

import type { ParsedHydraulicsPipeSegment } from '../types/hydraulics';

export type HydraulicsPipeLengthByRole = {
  /** Котёл → колектор / trunk (м). */
  mainLineM: number;
  /** Підводи колектор → прилади, segmentRole=branch (м). */
  collectorBranchesM: number;
};

/**
 * Сума довжин ділянок за призначенням (без петель ТП і ГВС).
 *
 * @param segments
 */
export function sumHydraulicsPipeLengthsByRole(
  segments: readonly ParsedHydraulicsPipeSegment[],
): HydraulicsPipeLengthByRole {
  let mainLineM = 0;
  let collectorBranchesM = 0;

  for (const seg of segments) {
    if (seg.lengthM <= 0) continue;

    if (seg.segmentRole === 'branch') {
      collectorBranchesM += seg.lengthM;
      continue;
    }

    if (
      seg.isMainLine === true
      || seg.segmentRole === 'main'
      || seg.segmentRole === 'trunk'
    ) {
      mainLineM += seg.lengthM;
    }
  }

  return {
    mainLineM: Math.round(mainLineM * 10) / 10,
    collectorBranchesM: Math.round(collectorBranchesM * 10) / 10,
  };
}
