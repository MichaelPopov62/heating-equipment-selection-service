/**
 * Назначение: Mongoose-схемы каталога оборудования и их подтипов.
 * Описание: baseProductSchema и схемы boiler, radiator, waterHeater, pipe, pump, indirectWaterHeater
 * для seed (scripts/seed.js). Контракт номенклатуры (powerKw, priceBasis, specs.volumeLiters и др.)
 * — validateAndNormalizeCatalog в catalog/validateCatalog.js (SSOT на чтение и запись).
 * strict: false намеренно: не дублировать полный контракт в Mongoose; прямой insert/update в
 * products без validateAndNormalizeCatalog ломает loadCatalog() на runtime.
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

export const baseProductSchema = new Schema(
  {
    kind: {
      type: String,
      required: true,
      enum: ['boiler', 'radiator', 'waterHeater', 'pipe', 'pump', 'indirectWaterHeater'],
    },
    /** Уникальный ключ строки каталога в seed (индекс + секция); не путать с «моделью для UI». */
    catalogKey: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
    discriminatorKey: 'kind',
    versionKey: false,
    // Расширенные поля из JSON (specs, brand, …) — контракт validateCatalog.js, не Mongoose.
    strict: false,
  },
);

baseProductSchema.index({ kind: 1, catalogKey: 1 }, { unique: true });

export const boilerSchema = new Schema({
  powerKw: {
    min: { type: Number, required: false },
    max: { type: Number, required: false },
  },
  fuel: { type: String, required: false, trim: true },
  efficiencyPercent: { type: Schema.Types.Mixed, required: false },
  isDoubleCircuit: { type: Boolean, required: false },
  gasConsumptionM3PerHour: { type: Number, required: false },
  /** Ориентировочная цена за единицу (валюта — metadata каталога); обязательна после validateCatalog. */
  price: { type: Number, required: true, min: 1 },
  mountingType: { type: String, required: false, enum: ['wall', 'floor'] },
  connectionDiameters: { type: [String], required: false, default: undefined },
});

export const radiatorSchema = new Schema({
  outputWatts: {
    deltaT70: { type: Number, required: false },
    deltaT50: { type: Number, required: false },
  },
  material: { type: String, required: false, trim: true },
  volumeLiters: { type: Number, required: false },
  /** Цена в валюте каталога; семантика — см. priceBasis (за секцию или за панель). */
  price: { type: Number, required: true, min: 1 },
  priceBasis: {
    type: String,
    required: true,
    enum: ['section', 'panel'],
  },
  dimensions: {
    height: { type: Number, required: false },
    width: { type: Number, required: false },
    depth: { type: Number, required: false },
    interaxle: { type: Number, required: false },
  },
  // Ширина одной секции (мм), если храните как отдельное поле.
  sectionWidthMm: { type: Number, required: false },
});

export const waterHeaterVariantSchema = new Schema(
  {
    volumeLiters: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 1 },
    powerKw: { type: Number, required: false, min: 0.1 },
    /** Время полного нагрева бака по паспорту, мин (опционально). */
    heatingTimeMinutes: { type: Number, required: false, min: 1 },
  },
  { _id: false },
);

export const waterHeaterSchema = new Schema({
  /** Накопительный электрический водонагреватель (MVP каталога). */
  type: { type: String, required: false, trim: true, default: 'electric_storage' },
  variants: { type: [waterHeaterVariantSchema], required: true },
  heatingElementType: { type: String, required: false, trim: true },
  powerDetails: { type: String, required: false, trim: true },
  features: { type: [String], required: false, default: undefined },
});

/** БКН в Mongo: цена и номенклатурный type (wall / floor / storage_indirect — три разных допустимых значения); остальное в JSON при strict: false у базы. */
export const indirectWaterHeaterSchema = new Schema({
  /** Цена розничная в валюте каталога (UAH). */
  price: { type: Number, required: true, min: 1 },
  type: {
    type: String,
    required: true,
    trim: true,
    enum: ['indirect_wall', 'indirect_floor', 'storage_indirect'],
  },
});

export const pipeSchema = new Schema({
  /** Дубли id из каталога для фильтров (корневое id из JSON тоже сохраняется). */
  pipeId: { type: String, required: false, trim: true },
  brand: { type: String, required: false, trim: true },
  material: { type: String, required: false, trim: true },
  diameter: { type: Number, required: false },
  wallThickness: { type: Number, required: false },
  price: { type: Number, required: false },
  category: { type: String, required: false, trim: true },
});

export const pumpSchema = new Schema({
  /** Дубли id из каталога для round-trip Mongo → validateCatalog. */
  pumpId: { type: String, required: false, trim: true },
  brand: { type: String, required: false, trim: true },
  type: { type: String, required: false, trim: true },
  segment: { type: String, required: false, trim: true },
  /** Ориентировочная цена (валюта — currency каталога); обязательна после validateCatalog. */
  price: { type: Number, required: false },
});
