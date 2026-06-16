/**
 * Назначение: Mongoose-модель сохранённого расчёта по проекту.
 * Описание: Хранит полный report, нормализованный вход и краткую сводку KPI в коллекции calculations.
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

/** KPI для списка расчётов (без полного report). */
const calculationSummarySchema = new Schema(
  {
    heatLossKw: { type: Number, required: false },
    hotWaterPowerKw: { type: Number, required: false },
    boilerRequiredKw: { type: Number, required: false },
    boilerModel: { type: String, required: false, trim: true },
    insideTempC: { type: Number, required: false },
    outsideTempC: { type: Number, required: false },
    objectType: { type: String, required: false, enum: ['house', 'apartment'] },
    warningsCount: { type: Number, required: false, min: 0 },
    generatedAt: { type: String, required: false, trim: true },
  },
  { _id: false },
);

/**
 * Сохранённый расчёт по проекту (полный report + нормализованный вход).
 * Коллекция MongoDB: calculations.
 */
const calculationSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    calcInput: { type: Schema.Types.Mixed, required: true },
    report: { type: Schema.Types.Mixed, required: true },
    summary: { type: calculationSummarySchema, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: 'calculations',
  },
);

calculationSchema.index({ projectId: 1, createdAt: -1 });

export const Calculation =
  mongoose.models.Calculation ?? mongoose.model('Calculation', calculationSchema);
