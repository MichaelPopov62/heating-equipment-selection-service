/**
 * Назначение: Mongoose-discriminator насосов для seed-скрипта.
 * Описание: Расширяет Product схемой pumpSchema; не входит в runtime public API models/public.js.
 */
import { Product } from './Product.js';
import { pumpSchema } from './productSchemas.js';

export const Pump =
  Product.discriminators?.pump ?? Product.discriminator('pump', pumpSchema);
