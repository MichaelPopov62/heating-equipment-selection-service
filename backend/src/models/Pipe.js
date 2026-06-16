/**
 * Назначение: Mongoose-discriminator труб для seed-скрипта.
 * Описание: Расширяет Product схемой pipeSchema; не входит в runtime public API models/public.js.
 */
import { Product } from './Product.js';
import { pipeSchema } from './productSchemas.js';

export const Pipe =
  Product.discriminators?.pipe ?? Product.discriminator('pipe', pipeSchema);
