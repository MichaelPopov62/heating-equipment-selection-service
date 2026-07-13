/**
 * Назначение: типы глобального предпочтения типа радиаторов (auto / sectional / panel).
 * Описание: Декларации для TypeScript frontend рядом с radiatorEmitterPreference.js.
 */

export type RadiatorEmitterPreference = 'auto' | 'sectional' | 'panel';

export type RadiatorEmitterKind = 'sectional' | 'panel';

export declare const RADIATOR_EMITTER_PREFERENCE_ENUM: readonly RadiatorEmitterPreference[];

export declare const DEFAULT_RADIATOR_EMITTER_PREFERENCE: RadiatorEmitterPreference;

export declare const RADIATOR_EMITTER_PREFERENCE_SURVEY_UI_OPTIONS: readonly {
  value: RadiatorEmitterPreference;
  label: string;
}[];

export declare function isRadiatorEmitterPreference(
  value: unknown,
): value is RadiatorEmitterPreference;

export declare function isRadiatorEmitterKind(
  value: unknown,
): value is RadiatorEmitterKind;

export declare function normalizeRadiatorEmitterPreference(
  value: unknown,
): RadiatorEmitterPreference;

export declare function radiatorEmitterPreferenceLabel(
  preference: RadiatorEmitterPreference,
): string;
