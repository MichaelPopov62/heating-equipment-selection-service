/**
 * Назначение: Mongoose-модель пользователя системы (auth Фаза 1).
 * Описание: Материализация JWT identity — JWT.sub → providerUserId, users._id → projects.ownerId.
 */
import mongoose from 'mongoose';

const { Schema } = mongoose;

/** @type {readonly ['clerk', 'auth0']} */
const AUTH_PROVIDER_VALUES = ['clerk', 'auth0'];

const userSchema = new Schema(
  {
    /** Провайдер аутентификации (IdP). Соответствует AuthIdentity.provider. */
    authProvider: {
      type: String,
      required: true,
      enum: AUTH_PROVIDER_VALUES,
      trim: true,
    },
    /** JWT claim sub — ключ поиска пользователя. Никогда не projects.ownerId. */
    providerUserId: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 320 },
    emailVerified: { type: Boolean, required: true, default: false },
    name: { type: String, required: false, trim: true, maxlength: 200 },
    /** Default 'user'; authorization logic — фаза 2. */
    role: { type: String, required: true, trim: true, default: 'user', maxlength: 64 },
    /** Default 'free'; subscription gates — фаза 2. */
    subscription: {
      type: String,
      required: true,
      trim: true,
      default: 'free',
      maxlength: 64,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'users',
  },
);

userSchema.index({ authProvider: 1, providerUserId: 1 }, { unique: true });
userSchema.index({ email: 1 });

/** @type {import('mongoose').Model<import('../types/shared-types.js').UserMongoDoc>} */
export const User =
  /** @type {import('mongoose').Model<import('../types/shared-types.js').UserMongoDoc>} */ (
    mongoose.models.User ?? mongoose.model('User', userSchema)
  );
