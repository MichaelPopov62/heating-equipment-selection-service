/**
 * Назначение: Mongoose-модель пресетов режимов тёплого пола.
 * Описание: Коллекция underfloor_heating_presets — UI-подписи и technical для расчёта.
 */
import mongoose from 'mongoose';

const underfloorHeatingPresetSchema = new mongoose.Schema(
  {
    kind: { type: String, default: 'ufhPreset' },
    presetId: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
    meta: { type: mongoose.Schema.Types.Mixed, required: true },
    technical: { type: mongoose.Schema.Types.Mixed, required: true },
    ui: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true, strict: false },
);

underfloorHeatingPresetSchema.index({ presetId: 1, isActive: 1 });

export const UnderfloorHeatingPreset = mongoose.model(
  'UnderfloorHeatingPreset',
  underfloorHeatingPresetSchema,
  'underfloor_heating_presets',
);
