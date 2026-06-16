/**
 * Назначение: публичный barrel HTTP-слоя.
 * Описание: Единая точка экспорта API-модулей для index.js и внешних потребителей. Реэкспортирует createRoutes, createProjectsRouter и validateAndNormalizeInput без собственной логики.
 */
export { createRoutes } from './routes.js';
export { createProjectsRouter } from './projectsRoutes.js';
export { validateAndNormalizeInput } from './validate.js';
