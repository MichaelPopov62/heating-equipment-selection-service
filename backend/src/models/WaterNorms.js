/**
 * Назначение: Mongoose-модель норм расчёта горячего водоснабжения.
 * Описание: Коллекция water_norms с расходами, сеансами, storage и физикой для расчёта ГВС в logic/hotWater.js.
 */
import mongoose from 'mongoose';

const waterNormsSchema = new mongoose.Schema(
  {
    schemaVersion: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    label: { type: String, trim: true },
    objectTypes: { type: mongoose.Schema.Types.Mixed, required: true },
    simultaneity: { type: mongoose.Schema.Types.Mixed, required: true },
    fixtureHotFlowLps: { type: mongoose.Schema.Types.Mixed, required: true },
    hotThermalFixtureKeys: { type: [String], required: true },
    coldWaterDesignC: { type: mongoose.Schema.Types.Mixed, required: true },
    hotWaterC: { type: mongoose.Schema.Types.Mixed, required: true },
    storage: { type: mongoose.Schema.Types.Mixed, required: true },
    session: { type: mongoose.Schema.Types.Mixed, required: true },
    physics: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true, strict: false },
);

export const WaterNorms = mongoose.model('WaterNorms', waterNormsSchema, 'water_norms');
