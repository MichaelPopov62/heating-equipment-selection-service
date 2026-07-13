/**
 * Назначение: типы предпочтения типа радиаторов для frontend.
 * Описание: Реэкспорт shared/radiatorEmitterPreference.
 */

export type {
  RadiatorEmitterPreference,
  RadiatorEmitterKind,
} from '../../../shared/radiatorEmitterPreference.js';

export {
  DEFAULT_RADIATOR_EMITTER_PREFERENCE,
  RADIATOR_EMITTER_PREFERENCE_ENUM,
  RADIATOR_EMITTER_PREFERENCE_SURVEY_UI_OPTIONS,
  isRadiatorEmitterPreference,
  isRadiatorEmitterKind,
  normalizeRadiatorEmitterPreference,
  radiatorEmitterPreferenceLabel,
} from '../../../shared/radiatorEmitterPreference.js';
