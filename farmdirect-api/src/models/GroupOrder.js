const mongoose = require('mongoose');

/**
 * A group order pools many buyers' quantities of ONE product from ONE supplier
 * so everyone gets the supplier's group price, delivered to one shared drop point
 * (e.g. a housing society gate or a shop).
 *
 * Invariants (enforced with atomic conditional updates in groupOrderService):
 *   - joinedQty === sum(qty of members with status reserved|paid)
 *   - joinedQty <= maxQty, always
 *   - nobody can join unless status === 'open' AND deadline > now
 *   - one active membership per user per group
 *   - maxQty is reserved from product stock when the group is created
 */
const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: String,
    qty: { type: Number, required: true, min: 1 },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    status: { type: String, enum: ['reserved', 'paid', 'left', 'expired', 'refunded'], default: 'reserved' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const groupOrderSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true }, // short shareable code
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, trim: true, maxlength: 100 },
    productName: String,
    unit: String,
    pricePerUnit: { type: Number, required: true, min: 1 }, // paise, locked at creation
    regularPrice: Number,
    minMemberQty: { type: Number, required: true, min: 1 },
    targetQty: { type: Number, required: true, min: 1 },
    maxQty: { type: Number, required: true, min: 1 },
    joinedQty: { type: Number, default: 0, min: 0 },
    paidQty: { type: Number, default: 0, min: 0 },
    dropPoint: {
      label: { type: String, trim: true, maxlength: 80 },
      line1: { type: String, trim: true, maxlength: 200 },
      city: String,
      state: String,
      pincode: { type: String, match: /^\d{6}$/, required: true },
    },
    deadline: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ['open', 'full', 'confirmed', 'failed', 'cancelled', 'completed'],
      default: 'open',
      index: true,
    },
    members: { type: [memberSchema], default: [] },
    stockReserved: { type: Number, default: 0 },
    closedAt: Date,
    closeReason: String,
  },
  { timestamps: true }
);

groupOrderSchema.index({ status: 1, 'dropPoint.pincode': 1, deadline: 1 });

groupOrderSchema.set('toJSON', { virtuals: true, versionKey: false });

module.exports = mongoose.model('GroupOrder', groupOrderSchema);
