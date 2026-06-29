/**
 * Назначение: авто-подбор шага укладки ТП (вариант B).
 * Описание: Перебор 100→150→200 мм; меньший шаг → выше q↑.
 */

import { computeUfhRoomHeatFlux } from './ufhRoomHeatFlux.js';
import {
  ALLOWED_PIPE_SPACING_MM,
  DEFAULT_PIPE_SPACING_MM,
} from './ufhPipeEmbedment.js';

/** @typedef {'matched_requested' | 'tightened' | 'none_sufficient'} UfhPipeSpacingResolution */

const FLUX_EPSILON_WM2 = 0.05;

/**
 * @param {object} fluxArgs — аргументы computeUfhRoomHeatFlux без pipeSpacingMm и areaM2
 * @param {number} pipeSpacingMm
 * @returns {number}
 */
function deliverableHeatFluxUpWm2(fluxArgs, pipeSpacingMm) {
  const flux = computeUfhRoomHeatFlux({
    ...fluxArgs,
    pipeSpacingMm,
    areaM2: 1,
  });
  return flux.heatFluxUpWm2;
}

/**
 * @param {object} args
 * @param {number} [args.requestedPipeSpacingMm]
 * @param {number | null} [args.qRequiredWm2]
 * @param {Omit<Parameters<typeof computeUfhRoomHeatFlux>[0], 'pipeSpacingMm' | 'areaM2'>} args.fluxContext
 * @returns {{
 *   requestedPipeSpacingMm: number,
 *   resolvedPipeSpacingMm: number,
 *   pipeSpacingResolution: UfhPipeSpacingResolution,
 * }}
 */
export function resolveUfhPipeSpacingMm(args) {
  const requestedPipeSpacingMm =
    ALLOWED_PIPE_SPACING_MM.includes(args.requestedPipeSpacingMm)
      ? args.requestedPipeSpacingMm
      : DEFAULT_PIPE_SPACING_MM;

  const qRequired = args.qRequiredWm2;
  if (qRequired == null || !(qRequired > 0)) {
    return {
      requestedPipeSpacingMm,
      resolvedPipeSpacingMm: requestedPipeSpacingMm,
      pipeSpacingResolution: 'matched_requested',
    };
  }

  /** @type {number[]} */
  const sufficientSpacings = [];
  for (const spacing of ALLOWED_PIPE_SPACING_MM) {
    const deliverable = deliverableHeatFluxUpWm2(args.fluxContext, spacing);
    if (deliverable + FLUX_EPSILON_WM2 >= qRequired) {
      sufficientSpacings.push(spacing);
    }
  }

  if (sufficientSpacings.includes(requestedPipeSpacingMm)) {
    return {
      requestedPipeSpacingMm,
      resolvedPipeSpacingMm: requestedPipeSpacingMm,
      pipeSpacingResolution: 'matched_requested',
    };
  }

  if (sufficientSpacings.length > 0) {
    const resolvedPipeSpacingMm = Math.min(...sufficientSpacings);
    return {
      requestedPipeSpacingMm,
      resolvedPipeSpacingMm,
      pipeSpacingResolution: 'tightened',
    };
  }

  return {
    requestedPipeSpacingMm,
    resolvedPipeSpacingMm: ALLOWED_PIPE_SPACING_MM[0],
    pipeSpacingResolution: 'none_sufficient',
  };
}
