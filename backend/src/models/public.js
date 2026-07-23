/**
 * Назначение: публичный баррель моделей MongoDB для runtime.
 * Описание: Реэкспортирует Product, Project, Calculation и User; discriminators (Boiler, Radiator, …) импортируются только из scripts/seed.js.
 */
export { Product } from './Product.js';
export { Project } from './Project.js';
export { Calculation } from './Calculation.js';
export { User } from './User.js';
