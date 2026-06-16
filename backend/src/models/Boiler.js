/**
 * Назначение: Mongoose-discriminator котлов для seed-скрипта.
 * Описание: Расширяет Product схемой boilerSchema; не входит в runtime public API models/public.js.
 */
import { Product } from './Product.js';
import { boilerSchema } from './productSchemas.js';

export const Boiler =
  Product.discriminators?.boiler ?? Product.discriminator('boiler', boilerSchema);
