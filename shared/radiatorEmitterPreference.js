/**
 * Назначение: глобальное предпочтение типа радиаторов на объекте.
 * Описание: auto | sectional | panel; ортогонально radiatorConnection.
 */

/** @typedef {'auto' | 'sectional' | 'panel'} RadiatorEmitterPreference */

/** @typedef {'sectional' | 'panel'} RadiatorEmitterKind */

/** @type {readonly RadiatorEmitterPreference[]} */
export const RADIATOR_EMITTER_PREFERENCE_ENUM = Object.freeze([
  'auto',
  'sectional',
  'panel',
]);

/** @type {RadiatorEmitterPreference} */
export const DEFAULT_RADIATOR_EMITTER_PREFERENCE = 'auto';

/** Подписи для select анкеты. */
export const RADIATOR_EMITTER_PREFERENCE_SURVEY_UI_OPTIONS = Object.freeze([
  {
    value: /** @type {RadiatorEmitterPreference} */ ('auto'),
    label: 'Авто (единый тип по объекту)',
  },
  {
    value: /** @type {RadiatorEmitterPreference} */ ('sectional'),
    label: 'Только секционные',
  },
  {
    value: /** @type {RadiatorEmitterPreference} */ ('panel'),
    label: 'Только панельные',
  },
]);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRadiatorEmitterPreference(value) {
  return value === 'auto' || value === 'sectional' || value === 'panel';
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRadiatorEmitterKind(value) {
  return value === 'sectional' || value === 'panel';
}

/**
 * Нормализация preference: неизвестное / пустое → auto.
 * @param {unknown} value
 * @returns {RadiatorEmitterPreference}
 */
export function normalizeRadiatorEmitterPreference(value) {
  return isRadiatorEmitterPreference(value)
    ? value
    : DEFAULT_RADIATOR_EMITTER_PREFERENCE;
}

/**
 * Человекочитаемая метка для notes / UI.
 * @param {RadiatorEmitterPreference} preference
 * @returns {string}
 */
export function radiatorEmitterPreferenceLabel(preference) {
  if (preference === 'sectional') return 'только секционные';
  if (preference === 'panel') return 'только панельные';
  return 'авто (единый тип по объекту)';
}
