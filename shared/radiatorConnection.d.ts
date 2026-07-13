/**
 * Назначение: типы схемы подводки радиаторов (side / bottom).
 * Описание: Декларации для TypeScript frontend рядом с radiatorConnection.js.
 */

export type RadiatorConnection = 'side' | 'bottom';

export declare const RADIATOR_CONNECTION_ENUM: readonly RadiatorConnection[];

export declare const DEFAULT_RADIATOR_CONNECTION: RadiatorConnection;

export declare const RADIATOR_CONNECTION_SURVEY_UI_OPTIONS: readonly {
  value: RadiatorConnection;
  label: string;
}[];

export declare function isRadiatorConnection(
  value: unknown,
): value is RadiatorConnection;

export declare function normalizeRadiatorConnection(
  value: unknown,
): RadiatorConnection;

export declare function radiatorConnectionLabel(
  connection: RadiatorConnection,
): string;
