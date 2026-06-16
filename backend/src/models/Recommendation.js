/**
 * Назначение: Mongoose-модель справочника текстов рекомендаций и предупреждений.
 * Описание: Коллекция recommendations с кодами REC_* и WARN_* для подстановки в отчёт расчёта.
 */
import mongoose from 'mongoose';

const recommendationSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true },
    schemaVersion: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    category: {
      type: String,
      required: true,
      trim: true,
      enum: ['warnings', 'automationHints'],
    },
    equipmentType: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true, strict: false },
);

recommendationSchema.index({ code: 1 }, { unique: true });
recommendationSchema.index({ isActive: 1, category: 1 });

export const Recommendation = mongoose.model(
  'Recommendation',
  recommendationSchema,
  'recommendations',
);
