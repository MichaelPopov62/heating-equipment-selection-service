/**
 * Назначение: базовая Mongoose-модель каталога оборудования.
 * Описание: Определяет коллекцию products с discriminatorKey kind; используется в runtime API и при загрузке каталога из MongoDB.
 */
import mongoose from 'mongoose';
import { baseProductSchema } from './productSchemas.js';

export const Product =
  mongoose.models.Product ?? mongoose.model('Product', baseProductSchema);
