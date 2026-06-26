/**
 * Назначение: математика кривой напора H(Q) циркуляционного насоса.
 * Описание: H = a·Q² + b·Q + c; общий SSOT для гидравлики и validateCatalog.
 */

/** Минимальный H(qMax) при валидации каталога (согласовано с appliances.hydraulics.pumpMinHeadAtQMaxM). */
export const PUMP_CURVE_MIN_HEAD_AT_QMAX_M = 0.5;

/**
 * @param {object} coeffs
 * @param {number} qM3h
 * @returns {number}
 */
export function pumpHeadM(coeffs, qM3h) {
  const a = Number(coeffs.a) || 0;
  const b = Number(coeffs.b) || 0;
  const c = Number(coeffs.c) || 0;
  return a * qM3h * qM3h + b * qM3h + c;
}

/**
 * Подрезает qMax до максимального Q на кривой с H ≥ minHeadAtQMaxM (мутирует mode.qMaxM3h).
 *
 * @param {{ qMinM3h: number; qMaxM3h: number; coefficients: object }} mode
 * @param {string} ctx
 * @param {number} [minHeadAtQMaxM]
 */
export function normalizePumpModeQMaxToCurve(
  mode,
  ctx,
  minHeadAtQMaxM = PUMP_CURVE_MIN_HEAD_AT_QMAX_M,
) {
  const coef = mode.coefficients;
  const qMin = mode.qMinM3h;
  const catalogQMax = mode.qMaxM3h;

  const hMin = pumpHeadM(coef, qMin);
  if (hMin <= 0) {
    throw new Error(
      `Каталог: H(qMin)≤0 (${ctx}), H(qMin)=${round3(hMin)} м.`,
    );
  }

  const hCatalogMax = pumpHeadM(coef, catalogQMax);
  if (hCatalogMax >= minHeadAtQMaxM && hMin >= hCatalogMax) {
    return;
  }

  let lo = qMin;
  let hi = catalogQMax;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (pumpHeadM(coef, mid) >= minHeadAtQMaxM) lo = mid;
    else hi = mid;
  }

  const clamped = Math.floor(lo * 100) / 100;
  if (clamped < qMin) {
    throw new Error(
      `Каталог: нет Q∈[qMin,qMax] с H≥${minHeadAtQMaxM} м (${ctx}).`,
    );
  }

  if (clamped < catalogQMax) {
    mode.qMaxM3h = clamped;
  }
}

/**
 * Геометрия кривой на [qMin, qMax]: положительный напор и убывание H при росте Q.
 *
 * @param {{ qMinM3h: number; qMaxM3h: number; coefficients: object }} mode
 * @param {string} ctx
 * @param {number} [minHeadAtQMaxM]
 */
export function assertPumpModeCurveGeometry(mode, ctx, minHeadAtQMaxM = PUMP_CURVE_MIN_HEAD_AT_QMAX_M) {
  const coef = mode.coefficients;
  const hMin = pumpHeadM(coef, mode.qMinM3h);
  const hMax = pumpHeadM(coef, mode.qMaxM3h);

  if (hMin <= 0) {
    throw new Error(
      `Каталог: H(qMin)≤0 (${ctx}), H(qMin)=${round3(hMin)} м.`,
    );
  }
  if (hMax < minHeadAtQMaxM) {
    throw new Error(
      `Каталог: H(qMax)<${minHeadAtQMaxM} м (${ctx}), H(qMax)=${round3(hMax)} м.`,
    );
  }
  if (hMin < hMax) {
    throw new Error(
      `Каталог: кривая не убывает на [qMin,qMax] (${ctx}): `
      + `H(qMin)=${round3(hMin)} < H(qMax)=${round3(hMax)} м.`,
    );
  }
}

/**
 * @param {number} x
 * @returns {number}
 */
function round3(x) {
  return Math.round(x * 1000) / 1000;
}
