/**
 * Назначение: публичный barrel модуля отчёта.
 * Описание: Реэкспортирует buildReport из buildReport.js как единственную точку входа для HTTP-слоя и projectsRoutes. Скрывает внутреннюю структуру report/ от внешних импортов.
 */
export { buildReport } from './buildReport.js';
