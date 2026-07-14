/**
 * Назначение: остаточная нагрузка на радиатор при смешанном режиме (радиаторы + ТП).
 * Описание: Вычитает heatFluxUpWatts из designWatts комнаты; при полном покрытии ТП подбор пропускается.
 */

/**
 * @param {import('../../types/shared-types.js').UnderfloorHeatingReport | null | undefined} underfloorHeating
 * @returns {Map<string, number>}
 */
export function buildUfhHeatFluxUpWattsByRoomId(underfloorHeating) {
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const row of underfloorHeating?.rooms ?? []) {
    const roomId = String(row?.roomId ?? '');
    const watts = row?.heatFluxUpWatts;
    if (!roomId || typeof watts !== 'number' || !Number.isFinite(watts) || watts <= 0) {
      continue;
    }
    map.set(roomId, watts);
  }
  return map;
}

/**
 * @param {object} args
 * @param {number} args.designWattsFull — designWatts комнаты (envelope × kVent), Вт
 * @param {number | undefined | null} args.ufhHeatFluxUpWatts — отдача ТП вверх по комнате, Вт
 * @returns {{
 *   qRad: number,
 *   designWattsFull: number,
 *   ufhHeatFluxUpWatts: number | null,
 *   sizingNotes: string[],
 *   skipRadiator: boolean,
 * }}
 */
export function resolveMixedRadiatorRoomLoad(args) {
  const { designWattsFull, ufhHeatFluxUpWatts } = args;
  const qFull = Math.max(0, designWattsFull);
  const ufhW =
    typeof ufhHeatFluxUpWatts === 'number'
    && Number.isFinite(ufhHeatFluxUpWatts)
    && ufhHeatFluxUpWatts > 0
      ? ufhHeatFluxUpWatts
      : null;

  if (ufhW == null) {
    return {
      qRad: qFull,
      designWattsFull: qFull,
      ufhHeatFluxUpWatts: null,
      sizingNotes: [],
      skipRadiator: false,
    };
  }

  const qRad = Math.max(0, qFull - ufhW);
  /** @type {string[]} */
  const sizingNotes = [];

  if (qRad <= 0) {
    sizingNotes.push(
      `Отдача ТП ≈${Math.round(ufhW)} Вт покрывает расчётную нагрузку ≈${Math.round(qFull)} Вт — радиатор не требуется.`,
    );
    return {
      qRad: 0,
      designWattsFull: qFull,
      ufhHeatFluxUpWatts: ufhW,
      sizingNotes,
      skipRadiator: true,
    };
  }

  sizingNotes.push(
    `С учётом ТП (≈${Math.round(ufhW)} Вт): остаточная нагрузка на радиатор ≈${Math.round(qRad)} Вт (из ≈${Math.round(qFull)} Вт).`,
  );

  return {
    qRad,
    designWattsFull: qFull,
    ufhHeatFluxUpWatts: ufhW,
    sizingNotes,
    skipRadiator: false,
  };
}
