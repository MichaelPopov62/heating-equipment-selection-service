/**
 * Назначение: Mongoose-модель клиентского проекта.
 * Описание: Хранит имя клиента, черновик анкеты (survey) и последний вход POST /calc в коллекции projects.
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Проект клиента: имя + черновик анкеты (UI) и последний ввод для расчёта.
 * Коллекция MongoDB: projects.
 */
const projectSchema = new Schema(
  {
    /** Владелец проекта (JWT sub). Обязателен для новых записей. */
    ownerId: { type: String, required: true, trim: true, index: true },
    clientName: { type: String, required: true, trim: true, maxlength: 200 },
    /** Краткая подпись объекта (опционально). */
    label: { type: String, required: false, trim: true, maxlength: 200 },
    /**
     * Снимок анкеты с фронта (schemaVersion, currentStep, objectMeta, rooms, …).
     * Не валидируется AJV — произвольный JSON объекта.
     */
    survey: { type: Schema.Types.Mixed, required: false },
    /** Последний нормализованный вход POST /calc (для повторного расчёта). */
    lastCalcInput: { type: Schema.Types.Mixed, required: false },
    /**
     * Непрозрачный токен публичной ссылки `/s/{shareToken}`.
     * Не равен Mongo ObjectId; отсутствует — ссылка не опубликована.
     */
    shareToken: { type: String, required: false, trim: true, sparse: true, unique: true },
    /** Когда снимок опубликован / обновлён. */
    sharePublishedAt: { type: Date, required: false },
    /**
     * Immutable whitelist для публичной страницы (commercial + matching slice).
     * Без survey / lastCalcInput / ownerId.
     */
    shareSnapshot: { type: Schema.Types.Mixed, required: false },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'projects',
  },
);

projectSchema.index({ updatedAt: -1 });
projectSchema.index({ clientName: 1 });
projectSchema.index({ ownerId: 1, updatedAt: -1 });

/** @type {import('mongoose').Model<import('../types/shared-types.js').ProjectMongoDoc>} */
export const Project =
  /** @type {import('mongoose').Model<import('../types/shared-types.js').ProjectMongoDoc>} */ (
    mongoose.models.Project ?? mongoose.model('Project', projectSchema)
  );
