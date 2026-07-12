/**
 * Назначение: Mongoose-discriminator унибоксов для seed-скрипта.
 * Описание: Расширяет Product схемой uniboxSchema; не входит в runtime public API models/public.js.
 */
import { Product } from './Product.js';
import { uniboxSchema } from './productSchemas.js';

export const Unibox =
  Product.discriminators?.unibox ?? Product.discriminator('unibox', uniboxSchema);
