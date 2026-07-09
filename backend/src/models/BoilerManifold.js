/**
 * Назначение: Mongoose-discriminator котельных коллекторов для seed-скрипта.
 * Описание: Расширяет Product схемой boilerManifoldSchema; не входит в runtime public API models/public.js.
 */
import { Product } from './Product.js';
import { boilerManifoldSchema } from './productSchemas.js';

export const BoilerManifold =
  Product.discriminators?.boilerManifold ??
  Product.discriminator('boilerManifold', boilerManifoldSchema);
