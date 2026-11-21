const mongoose = require('mongoose');
const { Schema } = mongoose;

// ---------------- Reviews (only verified, delivered purchases) ----------------
const reviewSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    buyer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    buyerName: String,
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 800 },
  },
  { timestamps: true }
);
reviewSchema.index({ order: 1, product: 1 }, { unique: true });

// ---------------- Disputes ----------------
const DISPUTE_REASONS = ['damaged', 'wrong_item', 'poor_quality', 'short_quantity', 'not_delivered', 'other'];
const disputeSchema = new Schema(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    buyer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    supplier: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, enum: DISPUTE_REASONS, required: true },
    description: { type: String, trim: true, required: true, minlength: 10, maxlength: 1500 },
    evidence: { type: [String], default: [] },
    requested: { type: String, enum: ['full_refund', 'partial_refund', 'replacement'], required: true },
    status: {
      type: String,
      enum: ['open', 'supplier_responded', 'resolved', 'rejected'],
      default: 'open',
      index: true,
    },
    supplierResponse: { type: String, trim: true, maxlength: 1500 },
    resolution: {
      outcome: { type: String, enum: ['full_refund', 'partial_refund', 'replacement', 'rejected'] },
      refundAmount: Number, // paise
      note: String,
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      at: Date,
      // Who bears the cost — kept explicit so supplier payouts can be adjusted.
      liableParty: { type: String, enum: ['supplier', 'platform', 'delivery_partner', 'none'] },
    },
  },
  { timestamps: true }
);

// ---------------- Notifications ----------------
const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: String,
    link: String,
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);
notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = {
  Review: mongoose.model('Review', reviewSchema),
  Dispute: mongoose.model('Dispute', disputeSchema),
  Notification: mongoose.model('Notification', notificationSchema),
  DISPUTE_REASONS,
};
