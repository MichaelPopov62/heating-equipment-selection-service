/**
 * Назначение: Mongoose-discriminator радиаторов для seed-скрипта.
 * Описание: Расширяет Product схемой radiatorSchema; не входит в runtime public API models/public.js.
 */
import { Product } from './Product.js';
import { radiatorSchema } from './productSchemas.js';

export const Radiator =
  Product.discriminators?.radiator ?? Product.discriminator('radiator', radiatorSchema);
