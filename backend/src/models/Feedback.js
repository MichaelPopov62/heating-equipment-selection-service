/**
 * Назначение: Mongoose-модель feedback (bug/contact).
 */

import mongoose from 'mongoose';

const { Schema } = mongoose;

const feedbackSchema = new Schema(
  {
    type: { type: String, required: true, enum: ['bug', 'contact'], index: true },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    email: { type: String, required: false, trim: true, maxlength: 200 },
    name: { type: String, required: false, trim: true, maxlength: 120 },
    pageUrl: { type: String, required: false, trim: true, maxlength: 2000 },
    appVersion: { type: String, required: false, trim: true, maxlength: 40 },
    buildId: { type: String, required: false, trim: true, maxlength: 80 },
    ownerSub: { type: String, required: false, trim: true, index: true },
    clientIp: { type: String, required: false, trim: true, maxlength: 64 },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'feedback',
  },
);

feedbackSchema.index({ createdAt: -1 });

/** @type {import('mongoose').Model<import('../types/shared-types.js').FeedbackMongoDoc>} */
export const Feedback =
  /** @type {import('mongoose').Model<import('../types/shared-types.js').FeedbackMongoDoc>} */ (
    mongoose.models.Feedback ?? mongoose.model('Feedback', feedbackSchema)
  );
