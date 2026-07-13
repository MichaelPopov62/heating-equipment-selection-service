/**
 * Назначение: схема подводки радиаторов (side / bottom).
 * Описание: Единый enum, дефолт side, нормализация и подписи для backend/frontend.
 */

/** @typedef {'side' | 'bottom'} RadiatorConnection */

/** @type {readonly RadiatorConnection[]} */
export const RADIATOR_CONNECTION_ENUM = Object.freeze(['side', 'bottom']);

/** @type {RadiatorConnection} */
export const DEFAULT_RADIATOR_CONNECTION = 'side';

/** Подписи для select анкеты. */
export const RADIATOR_CONNECTION_SURVEY_UI_OPTIONS = Object.freeze([
  { value: /** @type {RadiatorConnection} */ ('side'), label: 'Боковая подводка (K / Klasik)' },
  { value: /** @type {RadiatorConnection} */ ('bottom'), label: 'Нижняя подводка (VK / VKP)' },
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRadiatorConnection(value) {
  return value === 'side' || value === 'bottom';
}

/**
 * Нормализация подводки: неизвестное / пустое → side.
 * @param {unknown} value
 * @returns {RadiatorConnection}
 */
export function normalizeRadiatorConnection(value) {
  return isRadiatorConnection(value) ? value : DEFAULT_RADIATOR_CONNECTION;
}

/**
 * Человекочитаемая метка для notes / UI.
 * @param {RadiatorConnection} connection
 * @returns {string}
 */
export function radiatorConnectionLabel(connection) {
  return connection === 'bottom' ? 'нижняя' : 'боковая';
}
