/**
 * Назначение: Mongoose-модель правил подбора по типам техники.
 * Описание: Коллекция appliances с методикой для котла, БКН, электробойлера и радиаторов (не номенклатура products).
 */
import mongoose from 'mongoose';

const applianceSchema = new mongoose.Schema(
  {
    applianceKind: {
      type: String,
      required: true,
      trim: true,
      enum: [
        'indirect_water_heater',
        'boiler',
        'electric_storage',
        'radiator',
        'underfloor_heating',
      ],
    },
    schemaVersion: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
    label: { type: String, trim: true },
    coupling: { type: mongoose.Schema.Types.Mixed },
    selection: { type: mongoose.Schema.Types.Mixed },
    mounting: { type: mongoose.Schema.Types.Mixed },
    matching: { type: mongoose.Schema.Types.Mixed },
    hints: { type: mongoose.Schema.Types.Mixed },
    panelLengthRangeMm: { type: mongoose.Schema.Types.Mixed },
    distribution: { type: mongoose.Schema.Types.Mixed },
    mixingNode: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, strict: false },
);

applianceSchema.index({ applianceKind: 1, isActive: 1 });

export const Appliance = mongoose.model('Appliance', applianceSchema, 'appliances');
