/**
 * Назначение: разбор идентификаторов MongoDB.
 * Описание: безопасная валидация строкового параметра :id в маршрутах проектов и расчётов
 * перед запросами к коллекциям MongoDB.
 */
import mongoose from 'mongoose';

/**
 * @param {string} id
 * @returns {import('mongoose').Types.ObjectId | null}
 */
export function parseObjectIdParam(id) {
  const raw = String(id ?? '').trim();
  if (!mongoose.Types.ObjectId.isValid(raw)) return null;
  if (String(new mongoose.Types.ObjectId(raw)) !== raw) return null;
  return new mongoose.Types.ObjectId(raw);
}
