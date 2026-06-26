/**
 * Назначение: расчёт внутреннего диаметра и гидравлики участка трубы.
 * Описание: Darcy-Weisbach упрощённо; λ по шероховатости из appliances.
 */

import { round } from '../utils/math.js';

const RHO_KG_M3 = 1000;
const NU_M2_S = 1.004e-6;

/**
 * @param {import('../catalog/types').PipeCatalogItemNormalized} pipe
 * @returns {number}
 */
export function pipeInternalDiameterMm(pipe) {
  const od = Number(pipe.diameter) || 0;
  const wall = Number(pipe.wallThickness) || 0;
  return Math.max(0.1, od - 2 * wall);
}

/**
 * @param {number} flowM3PerHour
 * @param {number} internalDiameterMm
 * @returns {number}
 */
export function flowVelocityMps(flowM3PerHour, internalDiameterMm) {
  const qM3s = flowM3PerHour / 3600;
  const dM = internalDiameterMm / 1000;
  const area = (Math.PI * dM * dM) / 4;
  if (area <= 0) return 0;
  return qM3s / area;
}

/**
 * @param {number} re
 * @returns {number}
 */
function frictionFactor(re) {
  if (re < 2300) return 64 / Math.max(re, 1);
  return 0.316 / Math.pow(Math.max(re, 1), 0.25);
}

/**
 * @param {object} args
 * @param {number} args.flowM3PerHour
 * @param {number} args.lengthM
 * @param {number} args.internalDiameterMm
 * @param {number} args.roughnessMm
 * @param {number} [args.localZeta]
 * @returns {{ velocityMps: number, pressureDropKPa: number }}
 */
export function computeSegmentHydraulics({
  flowM3PerHour,
  lengthM,
  internalDiameterMm,
  roughnessMm,
  localZeta = 0,
}) {
  const v = flowVelocityMps(flowM3PerHour, internalDiameterMm);
  const dM = internalDiameterMm / 1000;
  const re = (v * dM) / NU_M2_S;
  const relRough = (roughnessMm / 1000) / Math.max(dM, 1e-6);
  const lambda = frictionFactor(re) * (1 + relRough * 10);

  const dynamicPa = 0.5 * RHO_KG_M3 * v * v;
  const frictionPa = lambda * (lengthM / Math.max(dM, 1e-6)) * dynamicPa;
  const localPa = localZeta * dynamicPa;
  const totalPa = frictionPa + localPa;

  return {
    velocityMps: round(v, 3),
    pressureDropKPa: round(totalPa / 1000, 2),
  };
}

/**
 * @param {string} material
 * @param {Record<string, number>} roughnessMap
 * @returns {number}
 */
export function resolveRoughnessMm(material, roughnessMap) {
  const key = String(material ?? '').toLowerCase();
  if (roughnessMap[key] != null) return roughnessMap[key];
  if (key.includes('pex')) return roughnessMap.pex ?? 0.007;
  if (key.includes('metal') || key.includes('pex-al')) {
    return roughnessMap.metal_plastic ?? 0.007;
  }
  return roughnessMap.steel ?? 0.15;
}

/**
 * @param {import('../catalog/types').PipeCatalogItemNormalized} pipe
 * @param {number} flowM3PerHour
 * @param {number} maxVelocityMps
 * @returns {boolean}
 */
export function pipeMeetsVelocityLimit(pipe, flowM3PerHour, maxVelocityMps) {
  const dMm = pipeInternalDiameterMm(pipe);
  const v = flowVelocityMps(flowM3PerHour, dMm);
  return v >= 0.05 && v <= maxVelocityMps;
}
