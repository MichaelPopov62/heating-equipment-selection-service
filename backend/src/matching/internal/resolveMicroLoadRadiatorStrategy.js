/**
 * Назначение: стратегия подбора радиатора при малой остаточной нагрузке (Ф5 «Тамбур»).
 * Описание: Входная зона — минимальный жизнеспособный прибор; внутреннее помещение — без радиатора.
 */

import {
  countExteriorWallsForRoom,
  inferRoomExteriorLayoutFromWallCounts,
} from '../../logic/roomExteriorLayoutHeatLoss.js';

/**
 * @typedef {'normal' | 'skip' | 'minimum_viable'} MicroLoadRadiatorAction
 */

/**
 * @typedef {object} MicroLoadRadiatorStrategy
 * @property {MicroLoadRadiatorAction} action
 * @property {string[]} sizingNotes
 */

/**
 * @param {object} args
 * @param {import('../../dhw/types.js').RadiatorApplianceRules['microLoad']} args.rules
 * @param {import('../../types/shared-types.js').HeatLossRoomReport} args.room
 * @param {import('../../types/shared-types.js').BuildingInput | null} [args.building]
 * @param {number} args.qRad - остаточная нагрузка на радиатор, Вт
 * @returns {MicroLoadRadiatorStrategy}
 */
export function resolveMicroLoadRadiatorStrategy({ rules, room, building, qRad }) {
  const threshold = rules.minDesignWattsThreshold;
  if (!(qRad > 0) || qRad >= threshold) {
    return { action: 'normal', sizingNotes: [] };
  }

  const roomId = String(room?.id ?? '');
  const roomType = String(room?.type ?? '').trim().toLowerCase();
  const entryTypes = new Set(rules.entryRoomTypes.map((t) => String(t).toLowerCase()));

  /** @type {'corner' | 'facade' | 'internal' | undefined} */
  let layout = building?.rooms?.find((r) => r.id === roomId)?.roomExteriorLayout;
  if (layout !== 'corner' && layout !== 'facade' && layout !== 'internal') {
    const counts = countExteriorWallsForRoom(building?.envelopeElements ?? [], roomId);
    layout = inferRoomExteriorLayoutFromWallCounts(counts);
  }

  const hasOuterWalls = layout === 'corner' || layout === 'facade';
  const isEntryRoomType = entryTypes.has(roomType);

  if (isEntryRoomType || hasOuterWalls) {
    return {
      action: 'minimum_viable',
      sizingNotes: [
        `Остаточная нагрузка ≈${Math.round(qRad)} Вт ниже порога ${threshold} Вт — `
        + 'входная зона: подобран минимальный жизнеспособный радиатор (защита от промерзания / комфорт у двери).',
      ],
    };
  }

  return {
    action: 'skip',
    sizingNotes: [
      `Остаточная нагрузка ≈${Math.round(qRad)} Вт ниже порога ${threshold} Вт — `
      + 'внутреннее помещение: радиатор не требуется (переток / микроколлектор гидравлики).',
    ],
  };
}
