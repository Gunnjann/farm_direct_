const mongoose = require('mongoose');

const refundSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    amount: { type: Number, required: true, min: 1 },
    providerRefundId: String,
    status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' },
    reason: String,
    at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const paymentSchema = new mongoose.Schema(
  {
    checkoutId: { type: String, required: true, unique: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
    amount: { type: Number, required: true, min: 100 }, // paise (Razorpay min ₹1)
    currency: { type: String, default: 'INR' },
    provider: { type: String, enum: ['razorpay', 'mock'], required: true },
    providerOrderId: { type: String, required: true, unique: true },
    // Unique: the same gateway payment can never be applied twice.
    providerPaymentId: { type: String, unique: true, sparse: true },
    status: { type: String, enum: ['created', 'paid', 'failed', 'expired'], default: 'created', index: true },
    method: String,
    failureReason: String,
    paidAt: Date,
    refunds: { type: [refundSchema], default: [] },
  },
  { timestamps: true }
);

paymentSchema.set('toJSON', { versionKey: false });

module.exports = mongoose.model('Payment', paymentSchema);
