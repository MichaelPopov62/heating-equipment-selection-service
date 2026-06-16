/**
 * Назначение: Mongoose-discriminator электрических водонагревателей для seed-скрипта.
 * Описание: Расширяет Product схемой waterHeaterSchema; не входит в runtime public API models/public.js.
 */
import { Product } from './Product.js';
import { waterHeaterSchema } from './productSchemas.js';

export const WaterHeater =
  Product.discriminators?.waterHeater ??
  Product.discriminator('waterHeater', waterHeaterSchema);
