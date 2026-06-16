/**
 * Назначение: реэкспорт подбора радиаторов для dev-скриптов.
 * Описание: Проксирует pickRadiators из pickRadiatorsCore.js; runtime API использует pickRadiatorsWithProposalLines.
 */
export { pickRadiators } from '../../src/matching/internal/pickRadiatorsCore.js';
