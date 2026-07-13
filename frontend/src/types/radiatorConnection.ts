/**
 * Назначение: типы подводки радиаторов для frontend.
 * Описание: Реэкспорт shared/radiatorConnection.
 */

export type { RadiatorConnection } from '../../../shared/radiatorConnection.js';

export {
  DEFAULT_RADIATOR_CONNECTION,
  RADIATOR_CONNECTION_ENUM,
  RADIATOR_CONNECTION_SURVEY_UI_OPTIONS,
  isRadiatorConnection,
  normalizeRadiatorConnection,
  radiatorConnectionLabel,
} from '../../../shared/radiatorConnection.js';
