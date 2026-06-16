/**
 * Назначение: Mongoose-discriminator бойлеров косвенного нагрева для seed-скрипта.
 * Описание: Расширяет Product схемой indirectWaterHeaterSchema; не входит в runtime public API models/public.js.
 */
import { Product } from './Product.js';
import { indirectWaterHeaterSchema } from './productSchemas.js';

export const IndirectWaterHeater =
  Product.discriminators?.indirectWaterHeater ??
  Product.discriminator('indirectWaterHeater', indirectWaterHeaterSchema);
