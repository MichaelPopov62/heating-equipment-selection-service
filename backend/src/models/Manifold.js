/**
 * Назначение: Mongoose-discriminator коллекторов для seed-скрипта.
 * Описание: Расширяет Product схемой manifoldSchema; не входит в runtime public API models/public.js.
 */
import { Product } from './Product.js';
import { manifoldSchema } from './productSchemas.js';

export const Manifold =
  Product.discriminators?.manifold ?? Product.discriminator('manifold', manifoldSchema);
